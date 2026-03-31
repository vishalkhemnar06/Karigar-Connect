// src/pages/client/ClientProfile.jsx
// Redesigned to match WorkerProfile GUI design
// Shows all fields from ClientRegister, editable except: name, mobile, idNumber, dob

import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Edit, Save, X, Mail, Phone, MapPin, Calendar,
    Shield, Camera, FileText, CheckCircle, Globe,
    Facebook, Twitter, Instagram, Linkedin,
    Briefcase, Star, Award, TrendingUp, Clock,
    Home, Building2, ChevronRight, Users,
    Trash2, Upload, AlertCircle
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const isImageFile = (url = '') => /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(url);
const isPdfFile   = (url = '') => /\.pdf(\?|$)/i.test(url);
const getFileKind = (url = '') => isImageFile(url) ? 'image' : isPdfFile(url) ? 'pdf' : 'other';

// ─── Main Component ──────────────────────────────────────────────────────────

const ClientProfile = () => {
    const [profile, setProfile]     = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData]   = useState({});
    const [loading, setLoading]     = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeSection, setActiveSection] = useState('personal');

    // Files
    const [files, setFiles] = useState({ photo: null, document: null });

    // Document viewer
    const [selectedDoc, setSelectedDoc]   = useState(null);
    const [viewerKind, setViewerKind]     = useState('');
    const [viewerLoading, setViewerLoading] = useState(false);
    const [viewerError, setViewerError]   = useState('');
    const [viewerBlobUrl, setViewerBlobUrl] = useState('');

    // Location
    const [locationError, setLocationError] = useState('');

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data } = await api.getClientProfile();
            setProfile(data);
        } catch { toast.error('Could not load profile.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchProfile(); }, []);

    // Initialize formData only when entering edit mode
    useEffect(() => {
        if (isEditing && profile) {
            initForm(profile);
        }
        if (!isEditing) {
            setFormData({});
        }
    }, [isEditing, profile]);

    useEffect(() => () => { if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl); }, [viewerBlobUrl]);

    const initForm = (data) => {
        setFormData({
            email:                data.email                        || '',
            gender:               data.gender                       || '',
            age:                  data.age                          || '',
            // Address
            fullAddress:          data.address?.fullAddress         || '',
            city:                 data.address?.city                || '',
            village:              data.address?.village             || '',
            locality:             data.address?.locality            || '',
            homeLocation:         data.address?.homeLocation        || '',
            houseNumber:          data.address?.houseNumber         || '',
            pincode:              data.address?.pincode             || '',
            latitude:             data.address?.latitude            ?? '',
            longitude:            data.address?.longitude           ?? '',
            // Professional / optional
            workplaceInfo:        data.workplaceInfo                || '',
            profession:           data.profession                   || '',
            signupReason:         data.signupReason                 || '',
            preferredPaymentMethod: data.preferredPaymentMethod     || '',
            socialProfile:        data.socialProfile                || '',
            // Emergency
            emergencyContactName:   data.emergencyContact?.name     || '',
            emergencyContactMobile: data.emergencyContact?.mobile   || '',
            // Social
            instagram:            data.social?.instagram            || '',
            twitter:              data.social?.twitter              || '',
            facebook:             data.social?.facebook             || '',
            linkedin:             data.social?.linkedin             || '',
        });
    };

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        if (type === 'number' && Number(value) < 0) return;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const { name, files: f } = e.target;
        setFiles(prev => ({ ...prev, [name]: f?.[0] || null }));
    };

    const captureLocation = () => {
        setLocationError('');
        if (!navigator.geolocation) { toast.error('Geolocation not supported.'); return; }
        navigator.geolocation.getCurrentPosition(
            async ({ coords: { latitude, longitude } }) => {
                setFormData(prev => ({ ...prev, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const d   = await res.json();
                    const a   = d?.address || {};
                    setFormData(prev => ({
                        ...prev,
                        fullAddress:  [a.house_number, a.road || a.street].filter(Boolean).join(', ') || prev.fullAddress,
                        city:         a.city || a.town || a.county || prev.city,
                        village:      a.village || a.hamlet || a.suburb || prev.village,
                        locality:     a.village || a.hamlet || a.suburb || prev.locality,
                        pincode:      a.postcode || prev.pincode,
                    }));
                    toast.success('Live location captured and address updated.');
                } catch { toast.success('Location captured. Fill remaining fields manually.'); }
            },
            (err) => {
                const msg = err.code === err.PERMISSION_DENIED ? 'Location permission denied.'
                    : err.code === err.POSITION_UNAVAILABLE    ? 'Location unavailable.'
                    : 'Location request timed out.';
                setLocationError(msg); toast.error(msg);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setUploading(true);
        const fd = new FormData();
        // locked fields excluded
        const locked = ['name', 'mobile', 'idNumber', 'dob'];
        Object.keys(formData).forEach(k => { if (!locked.includes(k)) fd.append(k, formData[k]); });
        if (files.photo)    fd.append('photo', files.photo);
        if (files.document) fd.append('document', files.document);
        const tid = toast.loading('Updating profile...');
        try {
            await api.updateClientProfile(fd);
            toast.success('Profile updated!', { id: tid });
            setIsEditing(false);
            setFiles({ photo: null, document: null });
            fetchProfile();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update.', { id: tid });
        } finally { setUploading(false); }
    };

    // ── Document viewer ───────────────────────────────────────────────────────

    const openDocument = async (doc) => {
        if (!doc?.url) return;
        const resolved = getImageUrl(doc.url);
        setSelectedDoc({ label: doc.label, url: resolved });
        if (viewerBlobUrl) { URL.revokeObjectURL(viewerBlobUrl); setViewerBlobUrl(''); }
        setViewerLoading(true); setViewerError(''); setViewerKind('');
        try {
            const res  = await fetch(resolved);
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const mime = blob.type || '';
            const kind = mime.startsWith('image/') ? 'image' : mime.includes('pdf') ? 'pdf' : getFileKind(doc.url);
            const fixed = kind === 'pdf' && !mime.includes('pdf') ? new Blob([blob], { type: 'application/pdf' })
                        : kind === 'image' && !mime.startsWith('image/') ? new Blob([blob], { type: 'image/jpeg' }) : blob;
            setViewerBlobUrl(URL.createObjectURL(fixed));
            setViewerKind(kind);
        } catch {
            const k = getFileKind(doc.url);
            if (k !== 'other') setViewerKind(k);
            else setViewerError('Preview unavailable for this file type.');
        } finally { setViewerLoading(false); }
    };

    // ── Sub-components ───────────────────────────────────────────────────────

    const DetailItem = ({ label, value, icon: Icon }) => (
        <motion.div whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-orange-50 to-amber-50 p-3 sm:p-4 rounded-xl border border-orange-100 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0 text-orange-600">
                    <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-orange-600 uppercase tracking-wide">{label}</p>
                    <p className="text-gray-800 font-medium text-sm sm:text-base mt-1 break-words">{value || 'Not provided'}</p>
                </div>
            </div>
        </motion.div>
    );

    const StatCard = ({ title, value, icon: Icon, gradient, delay = 0 }) => (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
            className={`bg-gradient-to-r ${gradient} p-4 rounded-xl text-white shadow-lg`}>
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm opacity-90">{title}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1 truncate">{value}</p>
                </div>
                <div className="p-2 bg-white/20 rounded-lg flex-shrink-0"><Icon size={20} /></div>
            </div>
        </motion.div>
    );

    const SectionBtn = ({ id, label, icon: Icon }) => (
        <button onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeSection === id
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-orange-100 hover:text-orange-600'
            }`}>
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(' ')[0]}</span>
        </button>
    );

    const DocumentViewerCard = ({ compact = false }) => {
        if (!selectedDoc) return (
            <div className={`bg-white border border-orange-200 rounded-xl ${compact ? 'p-4' : 'p-5'} text-center`}>
                <FileText size={24} className="text-orange-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Select a document to preview it here.</p>
            </div>
        );
        return (
            <div className="bg-white border border-orange-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-3 border-b border-orange-100 bg-orange-50">
                    <p className="text-sm font-semibold text-gray-800 truncate">{selectedDoc.label}</p>
                    <button type="button" onClick={() => setSelectedDoc(null)}
                        className="text-xs px-2 py-1 rounded-lg bg-white border border-orange-200 text-orange-700 hover:bg-orange-100">Close</button>
                </div>
                <div className={`bg-gray-50 ${compact ? 'h-64 sm:h-72' : 'h-72 sm:h-96'}`}>
                    {viewerLoading && <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" /></div>}
                    {!viewerLoading && viewerError && <div className="w-full h-full flex items-center justify-center px-4 text-center"><p className="text-sm text-gray-600">{viewerError}</p></div>}
                    {!viewerLoading && !viewerError && viewerKind === 'image' && (viewerBlobUrl || selectedDoc?.url) &&
                        <img src={viewerBlobUrl || selectedDoc.url} alt={selectedDoc.label} className="w-full h-full object-contain bg-white" />}
                    {!viewerLoading && !viewerError && viewerKind === 'pdf' && viewerBlobUrl &&
                        <iframe title={selectedDoc.label} src={`${viewerBlobUrl}#toolbar=0`} className="w-full h-full border-0 bg-white" />}
                    {!viewerLoading && !viewerError && !['image','pdf'].includes(viewerKind) &&
                        <div className="w-full h-full flex items-center justify-center px-4 text-center"><p className="text-sm text-gray-600">Preview only for PDF and image files.</p></div>}
                </div>
            </div>
        );
    };

    // ── Loading / Error states ───────────────────────────────────────────────

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto" />
                <p className="text-gray-600 mt-4 text-sm">Loading your profile...</p>
            </div>
        </div>
    );

    if (!profile) return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
            <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-orange-200 max-w-sm">
                <User size={32} className="text-orange-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h3>
                <button onClick={fetchProfile} className="mt-2 text-orange-600 font-bold text-sm hover:underline">Try Again</button>
            </div>
        </div>
    );

    // Derive document list (excluding ID card)
    const profileDocs = (profile.documents || []).filter(d => d.url && d.category !== 'idProof');

    const sections = [
        { id: 'personal',      label: 'Personal Info',  icon: User },
        { id: 'address',       label: 'Address',        icon: MapPin },
        { id: 'professional',  label: 'Professional',   icon: Briefcase },
        { id: 'social',        label: 'Social Links',   icon: Globe },
        { id: 'documents',     label: 'Documents',      icon: FileText },
    ];

    // ── EDIT FORM ────────────────────────────────────────────────────────────

    const EditForm = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 sm:p-6 text-white">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Edit size={20} />Edit Your Profile</h2>
                <p className="text-orange-100 text-xs sm:text-sm mt-1">Update your information (name, phone, ID, and date of birth are locked)</p>
            </div>

            <form onSubmit={handleUpdate} className="p-4 sm:p-6 space-y-6">

                {/* ── Photo ── */}
                <Section title="Profile Photo" icon={Camera}>
                    <div className="flex items-center gap-4">
                        <img src={getImageUrl(profile.photo, `https://ui-avatars.com/api/?name=${profile.name}&background=fb923c&color=fff`)}
                            alt={profile.name} className="w-20 h-20 rounded-2xl object-cover border-4 border-orange-200 shadow-lg" />
                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-4 text-center hover:border-orange-400 transition-colors bg-white flex-1">
                            <Camera size={24} className="text-orange-500 mx-auto mb-2" />
                            <input type="file" name="photo" id="photo-upload" accept="image/*" onChange={handleFileChange} className="hidden" />
                            <label htmlFor="photo-upload" className="cursor-pointer">
                                <div className="text-orange-600 font-semibold text-sm">Upload New Photo</div>
                                <p className="text-xs text-gray-500 mt-1">JPG, PNG (Max 5MB)</p>
                            </label>
                            {files.photo && <p className="text-xs text-green-600 mt-2">✓ {files.photo.name}</p>}
                        </div>
                    </div>
                </Section>

                {/* ── Contact Info ── */}
                <Section title="Contact Information" icon={Phone}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <LockedInput label="Full Name (Locked)" value={formData.name || profile.name} />
                        <LockedInput label="Mobile Number (Locked)" value={profile.mobile} />
                        <LockedInput label="Date of Birth (Locked)" value={profile.dob ? new Date(profile.dob).toLocaleDateString() : 'Not provided'} />
                        <LockedInput label="ID Card Number (Locked)" value={profile.idNumber || 'Locked after registration'} />
                        <EditInput label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} />
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-700">Gender</label>
                            <select name="gender" value={formData.gender} onChange={handleChange}
                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm">
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <EditInput label="Age" name="age" type="number" value={formData.age} onChange={handleChange} />
                    </div>
                </Section>

                {/* ── Address ── */}
                <Section title="Address Details" icon={MapPin}>
                    <div className="mb-4">
                        <button type="button" onClick={captureLocation}
                            className="px-5 py-2.5 bg-orange-100 text-orange-700 font-semibold rounded-xl hover:bg-orange-200 border border-orange-300 text-sm">
                            📍 Use Live Location
                        </button>
                        {locationError && <p className="text-xs text-red-600 mt-2">{locationError}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2"><EditInput label="Full Address" name="fullAddress" value={formData.fullAddress} onChange={handleChange} /></div>
                        <EditInput label="Home Location / Area" name="homeLocation" value={formData.homeLocation} onChange={handleChange} />
                        <EditInput label="House Number (Optional)" name="houseNumber" value={formData.houseNumber} onChange={handleChange} />
                        <EditInput label="City" name="city" value={formData.city} onChange={handleChange} />
                        <EditInput label="Village" name="village" value={formData.village} onChange={handleChange} />
                        <EditInput label="Locality (Optional)" name="locality" value={formData.locality} onChange={handleChange} />
                        <EditInput label="Pincode" name="pincode" value={formData.pincode} onChange={handleChange} />
                        <EditInput label="Latitude" name="latitude" value={formData.latitude} onChange={handleChange} />
                        <EditInput label="Longitude" name="longitude" value={formData.longitude} onChange={handleChange} />
                    </div>
                </Section>

                {/* ── Emergency Contact ── */}
                <Section title="Emergency Contact" icon={Shield}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <EditInput label="Contact Name" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} />
                        <EditInput label="Contact Mobile" name="emergencyContactMobile" type="tel" value={formData.emergencyContactMobile} onChange={handleChange} />
                    </div>
                </Section>

                {/* ── Professional ── */}
                <Section title="Professional Information" icon={Briefcase}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <EditInput label="Workplace / Profession" name="workplaceInfo" value={formData.workplaceInfo} onChange={handleChange} />
                        <EditInput label="Occupation" name="profession" value={formData.profession} onChange={handleChange} />
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-700">Reason for Signup</label>
                            <select name="signupReason" value={formData.signupReason} onChange={handleChange}
                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm">
                                <option value="">-- Select --</option>
                                <option>Home Service</option>
                                <option>Event</option>
                                <option>Business Project</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-700">Preferred Payment Method</label>
                            <select name="preferredPaymentMethod" value={formData.preferredPaymentMethod} onChange={handleChange}
                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm">
                                <option value="">-- Select --</option>
                                <option>UPI</option>
                                <option>Card</option>
                                <option>Bank Transfer</option>
                                <option>Digital Wallet</option>
                            </select>
                        </div>
                    </div>
                </Section>

                {/* ── Social Links ── */}
                <Section title="Social Link" icon={Globe}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <EditInput label="Website / Portfolio" name="socialProfile" type="url" value={formData.socialProfile} onChange={handleChange} placeholder="https://yourwebsite.com" />
                    </div>
                </Section>

                {/* ── Documents ── */}
                <Section title="Documents (Excluding ID Card)" icon={FileText}>
                    {/* Existing docs */}
                    {profileDocs.length > 0 && (
                        <div className="mb-4 space-y-3">
                            <h4 className="font-semibold text-gray-800 text-sm">Uploaded Documents</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {profileDocs.map((doc, idx) => {
                                    const isActive = selectedDoc?.url === getImageUrl(doc.url);
                                    return (
                                        <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${isActive ? 'border-orange-400 bg-orange-100' : 'border-orange-200 bg-white hover:bg-orange-50'}`}>
                                            <button type="button" onClick={() => openDocument(doc)} className="flex-1 text-left min-w-0">
                                                <span className="text-xs sm:text-sm text-gray-700 truncate block">{doc.label || doc.category || `Document ${idx + 1}`}</span>
                                            </button>
                                            <span className="text-[10px] font-bold text-orange-700">View</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <DocumentViewerCard />
                        </div>
                    )}

                    {/* Upload new doc */}
                    <div className="border-2 border-dashed border-orange-300 rounded-xl p-4 text-center hover:border-orange-400 transition-colors bg-white">
                        <Upload size={24} className="text-orange-500 mx-auto mb-2" />
                        <input type="file" name="document" id="doc-upload" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                        <label htmlFor="doc-upload" className="cursor-pointer">
                            <div className="text-orange-600 font-semibold text-sm">Upload Document (Image / PDF)</div>
                            <p className="text-xs text-gray-500 mt-1">Max 10MB</p>
                        </label>
                        {files.document && <p className="text-xs text-green-600 mt-2">✓ {files.document.name}</p>}
                    </div>
                </Section>

                {/* ── Actions ── */}
                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setIsEditing(false)}
                        className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all">
                        Cancel
                    </button>
                    <button type="submit" disabled={uploading}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                        {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save size={16} />}
                        {uploading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </motion.div>
    );

    // ── VIEW MODE ────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-24">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6 mb-4 sm:mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="relative">
                                <img
                                    src={getImageUrl(profile.photo, `https://ui-avatars.com/api/?name=${profile.name}&background=fb923c&color=fff&size=80`)}
                                    alt={profile.name}
                                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-4 border-orange-200 shadow-lg"
                                />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                    <CheckCircle size={10} className="text-white" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">{profile.name}</h1>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-mono">
                                        {profile.karigarId}
                                    </span>
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1">
                                        <Shield size={10} /> Verified Client
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsEditing(!isEditing)}
                            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                                isEditing
                                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg'
                            }`}>
                            {isEditing ? <X size={16} /> : <Edit size={16} />}
                            <span className="text-sm">{isEditing ? 'Cancel' : 'Edit Profile'}</span>
                        </button>
                    </div>
                </motion.div>

                {isEditing ? <EditForm /> : (
                    <div className="space-y-4 sm:space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            <StatCard title="Jobs Posted"  value={profile.jobsPosted  || 0} icon={Briefcase} gradient="from-orange-500 to-amber-500"   delay={0} />
                            <StatCard title="Hires Made"   value={profile.hiresMade   || 0} icon={CheckCircle} gradient="from-green-500 to-emerald-600" delay={0.1} />
                            <StatCard title="Active Jobs"  value={profile.activeJobs  || 0} icon={Clock}      gradient="from-blue-500 to-cyan-600"      delay={0.2} />
                            <StatCard title="Rating"       value={profile.rating       ? `${profile.rating}★` : 'N/A'} icon={Star} gradient="from-purple-500 to-pink-600" delay={0.3} />
                        </div>

                        {/* Section nav */}
                        <div className="bg-white rounded-xl p-1 flex gap-1 overflow-x-auto shadow-sm">
                            {sections.map(s => <SectionBtn key={s.id} id={s.id} label={s.label} icon={s.icon} />)}
                        </div>

                        {/* ── Personal ── */}
                        {activeSection === 'personal' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6">
                                <SectionHeading icon={User} title="Personal Information" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    <DetailItem label="Full Name"   value={profile.name}   icon={User} />
                                    <DetailItem label="Mobile"      value={profile.mobile} icon={Phone} />
                                    <DetailItem label="Email"       value={profile.email}  icon={Mail} />
                                    <DetailItem label="Gender"      value={profile.gender} icon={User} />
                                    <DetailItem label="Age"         value={profile.age ? `${profile.age} years` : null} icon={Calendar} />
                                    <DetailItem label="Date of Birth" value={profile.dob ? new Date(profile.dob).toLocaleDateString() : null} icon={Calendar} />
                                    <DetailItem label="ID Type"     value={profile.idType || profile.idProof?.idType} icon={Shield} />
                                    <DetailItem label="ID Number"   value={'Protected'} icon={Shield} />
                                </div>

                                {/* Emergency Contact */}
                                <div className="mt-6 pt-4 border-t border-orange-100">
                                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                        <Shield size={16} className="text-orange-500" /> Emergency Contact
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <DetailItem label="Contact Name"   value={profile.emergencyContact?.name}   icon={User} />
                                        <DetailItem label="Contact Mobile" value={profile.emergencyContact?.mobile} icon={Phone} />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Address ── */}
                        {activeSection === 'address' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6">
                                <SectionHeading icon={MapPin} title="Address Details" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    <DetailItem label="Full Address"  value={profile.address?.fullAddress}   icon={MapPin} />
                                    <DetailItem label="City"          value={profile.address?.city}          icon={Building2} />
                                    <DetailItem label="Village / Area" value={profile.address?.village}      icon={Home} />
                                    <DetailItem label="Locality"      value={profile.address?.locality}      icon={Home} />
                                    <DetailItem label="Home Location" value={profile.address?.homeLocation}  icon={MapPin} />
                                    <DetailItem label="House Number"  value={profile.address?.houseNumber}   icon={Home} />
                                    <DetailItem label="Pincode"       value={profile.address?.pincode}       icon={Building2} />
                                    <DetailItem label="Latitude"      value={profile.address?.latitude != null ? String(profile.address.latitude) : null}  icon={MapPin} />
                                    <DetailItem label="Longitude"     value={profile.address?.longitude != null ? String(profile.address.longitude) : null} icon={MapPin} />
                                </div>
                            </motion.div>
                        )}

                        {/* ── Professional ── */}
                        {activeSection === 'professional' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6">
                                <SectionHeading icon={Briefcase} title="Professional Information" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    <DetailItem label="Workplace"           value={profile.workplaceInfo}          icon={Briefcase} />
                                    <DetailItem label="Occupation"          value={profile.profession}             icon={Award} />
                                    <DetailItem label="Signup Reason"       value={profile.signupReason}           icon={FileText} />
                                    <DetailItem label="Preferred Payment"   value={profile.preferredPaymentMethod} icon={TrendingUp} />
                                    <DetailItem label="Previous Hiring Exp" value={profile.previousHiringExperience === true ? 'Yes' : profile.previousHiringExperience === false ? 'No' : null} icon={Users} />
                                </div>
                            </motion.div>
                        )}

                        {/* ── Social ── */}
                        {activeSection === 'social' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6">
                                <SectionHeading icon={Globe} title="Social Link" />
                                {profile.socialProfile ? (
                                    <a href={profile.socialProfile} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-gray-50 transition-all">
                                        <div className="p-1.5 sm:p-2 rounded-lg bg-gray-50"><Globe size={14} className="text-gray-500" /></div>
                                        <span className="text-sm font-bold text-gray-700 hover:text-orange-600 truncate flex-1">Website</span>
                                        <ChevronRight size={14} className="text-gray-300" />
                                    </a>
                                ) : (
                                    <div className="text-center py-8">
                                        <Globe size={32} className="mx-auto text-gray-200 mb-3" />
                                        <p className="text-gray-400 text-sm">No social link added</p>
                                        <button onClick={() => setIsEditing(true)} className="mt-2 text-orange-500 text-xs font-bold hover:underline">Add Social Link</button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ── Documents ── */}
                        {activeSection === 'documents' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6">
                                <SectionHeading icon={FileText} title="Certificates & Documents" subtitle="(ID Card excluded from preview for privacy)" />
                                {profileDocs.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {profileDocs.map((doc, idx) => {
                                                const isActive = selectedDoc?.url === getImageUrl(doc.url);
                                                return (
                                                    <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${isActive ? 'border-orange-400 bg-orange-100' : 'border-orange-200 bg-white hover:bg-orange-50'}`}>
                                                        <button type="button" onClick={() => openDocument(doc)} className="flex-1 text-left min-w-0 flex items-center gap-2">
                                                            <FileText size={16} className="text-orange-500 flex-shrink-0" />
                                                            <span className="text-sm text-gray-700 truncate block">{doc.label || doc.category || `Document ${idx + 1}`}</span>
                                                        </button>
                                                        <span className="text-[10px] font-bold text-orange-700">View</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <DocumentViewerCard />
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <FileText size={32} className="mx-auto text-gray-200 mb-3" />
                                        <p className="text-gray-400 text-sm">No documents uploaded yet</p>
                                        <button onClick={() => setIsEditing(true)} className="mt-2 text-orange-500 text-xs font-bold hover:underline">Upload Documents</button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Tiny helper sub-components ───────────────────────────────────────────────

const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-6 rounded-xl border border-orange-200">
        <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
            <Icon size={18} />{title}
        </h3>
        {children}
    </div>
);

const SectionHeading = ({ icon: Icon, title, subtitle }) => (
    <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
        <Icon size={18} />{title}
        {subtitle && <span className="text-xs font-normal text-gray-400 ml-1">{subtitle}</span>}
    </h3>
);

const LockedInput = ({ label, value }) => (
    <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-500">{label}</label>
        <input value={value || ''} disabled
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl bg-gray-100 text-sm text-gray-500 cursor-not-allowed" readOnly />
    </div>
);

const EditInput = ({ label, name, type = 'text', value, onChange, placeholder }) => (
    <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-700">{label}</label>
        <input type={type} name={name} value={value || ''} onChange={onChange} placeholder={placeholder}
            className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white text-sm transition-all" />
    </div>
);

export default ClientProfile;