import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    User, Edit, X, Mail, MapPin, Briefcase, Trash2,
    Phone, Camera, CheckCircle, Award,
    Globe, Building2, Star,
    Facebook, Twitter, Instagram, Linkedin, Shield, Save
} from 'lucide-react';

const ClientProfile = () => {
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [newPhoto, setNewPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data } = await api.getClientProfile();
            setProfile(data);
            setFormData({
                email: data.email || '',
                city: data.address?.city || '',
                pincode: data.address?.pincode || '',
                homeLocation: data.address?.homeLocation || '',
                houseNumber: data.address?.houseNumber || '',
                workplaceInfo: data.workplaceInfo || '',
                socialProfile: data.socialProfile || '',
                instagram: data.social?.instagram || '',
                twitter: data.social?.twitter || '',
                facebook: data.social?.facebook || '',
                linkedin: data.social?.linkedin || '',
            });
        } catch { toast.error("Could not load profile."); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchProfile(); }, []);

    useEffect(() => {
        if (newPhoto) {
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result);
            reader.readAsDataURL(newPhoto);
        } else { setPhotoPreview(null); }
    }, [newPhoto]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleUpdate = async (e) => {
        e.preventDefault();
        const data = new FormData();
        Object.keys(formData).forEach(key => data.append(key, formData[key]));
        if (newPhoto) data.append('photo', newPhoto);
        const toastId = toast.loading('Updating profile...');
        try {
            await api.updateClientProfile(data);
            toast.success('Profile updated!', { id: toastId });
            setIsEditing(false);
            setNewPhoto(null);
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update.', { id: toastId });
        }
    };

    const handleDeleteAccount = () => {
        if (window.confirm("WARNING: Permanently delete your account? This cannot be undone.")) {
            toast.error("Account deletion API not yet implemented. Contact Admin.");
        }
    };

    const DetailRow = ({ label, value, icon: Icon }) => (
        <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {Icon && <Icon size={15} className="text-orange-600" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className="text-sm text-gray-800 font-bold truncate">{value || 'Not provided'}</p>
            </div>
        </div>
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50/30">
            <div className="text-center">
                <div className="w-14 h-14 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 font-bold text-sm">Loading profile...</p>
            </div>
        </div>
    );

    if (!profile) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center bg-white p-6 rounded-2xl shadow-lg border border-orange-100">
                <p className="text-red-500 font-bold">Failed to load profile</p>
                <button onClick={fetchProfile} className="mt-3 text-orange-600 font-bold text-sm hover:underline">Try Again</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-orange-50/20">
            <div className="max-w-5xl mx-auto p-4 lg:p-8">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black text-gray-900">My Profile</h1>
                        <p className="text-gray-400 text-sm mt-1 font-medium">Manage your account information</p>
                    </div>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${isEditing ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200 hover:from-orange-600 hover:to-orange-700'}`}
                    >
                        {isEditing ? <><X size={16} /> Cancel</> : <><Edit size={16} /> Edit Profile</>}
                    </button>
                </div>

                {isEditing ? (
                    /* ── EDIT FORM ── */
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5">
                            <h2 className="text-base font-black text-white">Edit Your Profile</h2>
                        </div>
                        <form onSubmit={handleUpdate} className="p-6 space-y-6">

                            {/* Photo */}
                            <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
                                <div className="relative">
                                    <img src={photoPreview || getImageUrl(profile.photo, `https://ui-avatars.com/api/?name=${profile.name}&background=ff7e33&color=fff`)} alt={profile.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-200" />
                                    <label htmlFor="photo-upload" className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-orange-600 shadow-md">
                                        <Camera size={12} className="text-white" />
                                    </label>
                                    <input type="file" id="photo-upload" onChange={e => setNewPhoto(e.target.files[0])} accept="image/*" className="hidden" />
                                </div>
                                <div>
                                    <p className="font-black text-gray-800">{profile.name}</p>
                                    <p className="text-xs text-gray-500">{profile.karigarId}</p>
                                </div>
                            </div>

                            {/* Contact */}
                            <div>
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Contact Info</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">Email</label>
                                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">Phone (Read-only)</label>
                                        <input value={profile.mobile} disabled className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-100 rounded-xl text-gray-400 cursor-not-allowed" />
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Address</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">City</label>
                                        <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">Pincode</label>
                                        <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">Area / Location</label>
                                        <input type="text" name="homeLocation" value={formData.homeLocation} onChange={handleChange} className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Professional */}
                            <div>
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Professional</h3>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">Workplace / Profession</label>
                                <input type="text" name="workplaceInfo" value={formData.workplaceInfo} onChange={handleChange} className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
                            </div>

                            {/* Social */}
                            <div>
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Social Links</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { name: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
                                        { name: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'text-blue-400' },
                                        { name: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
                                        { name: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700' },
                                    ].map(({ name, label, icon: Icon, color }) => (
                                        <div key={name}>
                                            <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Icon size={12} className={color} />{label}</label>
                                            <input type="url" name={name} value={formData[name]} onChange={handleChange} placeholder="https://" className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between pt-4 border-t border-gray-100">
                                <button type="button" onClick={handleDeleteAccount} className="px-4 py-2.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-all">Delete Account</button>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all">Cancel</button>
                                    <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-black rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all flex items-center gap-2 shadow-md shadow-orange-200">
                                        <Save size={15} /> Save Changes
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                ) : (
                    /* ── VIEW MODE ── */
                    <div className="space-y-5">
                        {/* Profile Header */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
                                <div className="flex items-center gap-4">
                                    <img src={getImageUrl(profile.photo, `https://ui-avatars.com/api/?name=${profile.name}&background=ff7e33&color=fff`)} alt={profile.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shadow-lg" />
                                    <div>
                                        <h2 className="text-2xl font-black text-white">{profile.name}</h2>
                                        <p className="text-orange-100 text-sm">{profile.karigarId}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-white/20 text-white font-bold"><Shield size={10} className="mr-1" /> Client</span>
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-green-400/30 text-white font-bold"><CheckCircle size={10} className="mr-1" /> Verified</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Quick strip */}
                            <div className="grid grid-cols-3 divide-x divide-gray-100">
                                <div className="p-4 text-center">
                                    <Phone size={16} className="text-orange-400 mx-auto mb-1" />
                                    <p className="text-xs text-gray-400">Phone</p>
                                    <p className="font-black text-gray-800 text-sm mt-0.5">{profile.mobile}</p>
                                </div>
                                <div className="p-4 text-center">
                                    <Mail size={16} className="text-orange-400 mx-auto mb-1" />
                                    <p className="text-xs text-gray-400">Email</p>
                                    <p className="font-black text-gray-800 text-sm mt-0.5 truncate px-2">{profile.email || 'Not set'}</p>
                                </div>
                                <div className="p-4 text-center">
                                    <MapPin size={16} className="text-orange-400 mx-auto mb-1" />
                                    <p className="text-xs text-gray-400">City</p>
                                    <p className="font-black text-gray-800 text-sm mt-0.5">{profile.address?.city || 'Not set'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Personal */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-50 bg-gradient-to-r from-orange-500 to-orange-600">
                                    <h3 className="text-sm font-black text-white">Personal Info</h3>
                                </div>
                                <div className="px-5">
                                    <DetailRow label="Full Name" value={profile.name} icon={User} />
                                    <DetailRow label="Email" value={profile.email || 'Not provided'} icon={Mail} />
                                    <DetailRow label="Phone" value={profile.mobile} icon={Phone} />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-50 bg-gradient-to-r from-orange-500 to-orange-600">
                                    <h3 className="text-sm font-black text-white">Address</h3>
                                </div>
                                <div className="px-5">
                                    <DetailRow label="City" value={profile.address?.city} icon={MapPin} />
                                    <DetailRow label="Pincode" value={profile.address?.pincode} icon={Building2} />
                                    <DetailRow label="Area" value={profile.address?.homeLocation} icon={Building2} />
                                </div>
                            </div>

                            {/* Professional */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-50 bg-gradient-to-r from-orange-500 to-orange-600">
                                    <h3 className="text-sm font-black text-white">Professional</h3>
                                </div>
                                <div className="px-5">
                                    <DetailRow label="Workplace" value={profile.workplaceInfo} icon={Briefcase} />
                                    <DetailRow label="Jobs Posted" value={profile.jobsPosted || 0} icon={Award} />
                                    <DetailRow label="Hires Made" value={profile.hiresMade || 0} icon={Star} />
                                </div>
                            </div>

                            {/* Social */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-50 bg-gradient-to-r from-orange-500 to-orange-600">
                                    <h3 className="text-sm font-black text-white">Social Links</h3>
                                </div>
                                <div className="p-4">
                                    {!profile.social?.instagram && !profile.social?.twitter && !profile.social?.facebook && !profile.social?.linkedin && !profile.socialProfile ? (
                                        <div className="text-center py-5">
                                            <Globe size={24} className="mx-auto text-gray-200 mb-2" />
                                            <p className="text-gray-400 text-sm">No social links added</p>
                                            <button onClick={() => setIsEditing(true)} className="mt-2 text-orange-500 text-xs font-bold hover:underline">Add Social Links</button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {[
                                                { icon: Instagram, value: profile.social?.instagram, label: 'Instagram', color: 'text-pink-500 bg-pink-50' },
                                                { icon: Twitter, value: profile.social?.twitter, label: 'Twitter', color: 'text-blue-400 bg-blue-50' },
                                                { icon: Facebook, value: profile.social?.facebook, label: 'Facebook', color: 'text-blue-600 bg-blue-50' },
                                                { icon: Linkedin, value: profile.social?.linkedin, label: 'LinkedIn', color: 'text-blue-700 bg-blue-50' },
                                                { icon: Globe, value: profile.socialProfile, label: 'Website', color: 'text-gray-500 bg-gray-50' },
                                            ].filter(s => s.value).map(({ icon: Icon, value, label, color }) => (
                                                <a key={label} href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-all group">
                                                    <div className={`p-2 rounded-lg ${color.split(' ')[1]}`}>
                                                        <Icon size={15} className={color.split(' ')[0]} />
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-700 group-hover:text-orange-600 truncate">{label}</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientProfile;