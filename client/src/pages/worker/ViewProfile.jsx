// src/pages/worker/ViewProfile.jsx
// MOBILE-FRIENDLY & ENHANCED VERSION
// Features: Responsive design, touch-friendly, modern gradients, animations

import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect, useRef } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, Edit, Save, X, Mail, Phone, MapPin, Calendar, 
    Award, Briefcase, BookOpen, Shield, Download, Camera,
    Star, CheckCircle, Clock, Award as AwardIcon, Plus, Trash2,
    ChevronRight, ChevronDown, Globe, Heart, Users, TrendingUp,
    Upload, FileText, Link, ExternalLink, Smartphone, Home
} from 'lucide-react';

const ViewProfile = () => {
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [skillsData, setSkillsData] = useState([]);
    const [referencesData, setReferencesData] = useState([]);
    const [files, setFiles] = useState({ photo: null, otherCertificates: [] });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeSection, setActiveSection] = useState('personal');
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const initializeFormData = (data) => {
        setFormData({
            email: data.email || '',
            city: data.address?.city || '',
            pincode: data.address?.pincode || '',
            locality: data.address?.locality || '',
            phoneType: data.phoneType || 'Smartphone',
            overallExperience: data.overallExperience || 'Beginner',
            experience: data.experience || '',
            emergencyContactName: data.emergencyContact?.name || '',
            emergencyContactMobile: data.emergencyContact?.mobile || '',
            education: data.education || '',
        });
        setSkillsData(data.skills || []);
        setReferencesData(data.references || []);
    };

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data } = await api.getWorkerProfile();
            setProfile(data);
            initializeFormData(data);
        } catch (error) {
            toast.error("Could not load profile.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    const handleFileChange = (e) => {
        const { name, files: selectedFiles } = e.target;
        if (selectedFiles) {
            if (name === 'otherCertificates') {
                setFiles(prev => ({ ...prev, [name]: Array.from(selectedFiles) }));
            } else {
                setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
            }
        }
    };

    const handleSkillChange = (index, key, value) => {
        const newSkills = [...skillsData];
        newSkills[index][key] = value;
        setSkillsData(newSkills);
    };

    const addSkill = () => {
        setSkillsData([...skillsData, { name: '', proficiency: 'Medium' }]);
    };

    const removeSkill = (index) => {
        setSkillsData(skillsData.filter((_, i) => i !== index));
    };

    const handleReferenceChange = (index, key, value) => {
        const newReferences = [...referencesData];
        newReferences[index][key] = value;
        setReferencesData(newReferences);
    };

    const addReference = () => {
        setReferencesData([...referencesData, { name: '', contact: '' }]);
    };

    const removeReference = (index) => {
        setReferencesData(referencesData.filter((_, i) => i !== index));
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setUploading(true);
        
        const data = new FormData();
        Object.keys(formData).forEach(key => data.append(key, formData[key]));
        data.append('skills', JSON.stringify(skillsData.filter(s => s.name.trim() !== '')));
        data.append('references', JSON.stringify(referencesData.filter(r => r.name.trim() !== '' && r.contact.trim() !== '')));

        if (files.photo) data.append('photo', files.photo);
        Array.from(files.otherCertificates || []).forEach(file => data.append('otherCertificates', file));

        const toastId = toast.loading('Updating profile...');
        try {
            await api.updateWorkerProfile(data);
            toast.success('Profile updated successfully!', { id: toastId });
            setIsEditing(false);
            setFiles({ photo: null, otherCertificates: [] });
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile.', { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    const DetailItem = ({ label, value, icon: Icon, color = "text-orange-600" }) => (
        <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-orange-50 to-amber-50 p-3 sm:p-4 rounded-xl border border-orange-100 hover:shadow-md transition-all"
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 bg-orange-100 rounded-lg flex-shrink-0 ${color}`}>
                    <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-bold text-orange-600 uppercase tracking-wide">{label}</p>
                    <p className="text-gray-800 font-medium text-sm sm:text-base mt-1 break-words">{value || 'Not provided'}</p>
                </div>
            </div>
        </motion.div>
    );

    const StatCard = ({ title, value, subtitle, icon: Icon, gradient, delay = 0 }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`bg-gradient-to-r ${gradient} p-4 rounded-xl text-white shadow-lg hover:shadow-xl transition-all`}
        >
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm opacity-90">{title}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1 truncate">{value}</p>
                    {subtitle && <p className="text-[10px] sm:text-xs opacity-80 mt-1">{subtitle}</p>}
                </div>
                <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                    <Icon size={20} />
                </div>
            </div>
        </motion.div>
    );

    const SectionButton = ({ id, label, icon: Icon, active }) => (
        <button
            onClick={() => { setActiveSection(id); setShowMobileMenu(false); }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                active === id 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-orange-100 hover:text-orange-600'
            }`}
        >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(' ')[0]}</span>
        </button>
    );

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-gray-600 mt-4 text-sm">Loading your profile...</p>
            </div>
        </div>
    );
    
    if (!profile) return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
            <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-orange-200 max-w-sm">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User size={32} className="text-orange-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h3>
                <p className="text-gray-600 text-sm">Could not load profile data. Please try again.</p>
            </div>
        </div>
    );

    const sections = [
        { id: 'personal', label: 'Personal Info', icon: User },
        { id: 'professional', label: 'Professional', icon: Briefcase },
        { id: 'skills', label: 'Skills', icon: Award },
        { id: 'references', label: 'References', icon: Users },
        { id: 'documents', label: 'Documents', icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-24">
                {/* Header Section - Mobile Optimized */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6 mb-4 sm:mb-6"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="relative">
                                <img 
                                    src={profile.photo ? getImageUrl(profile.photo) : `https://ui-avatars.com/api/?name=${profile.name}&background=fb923c&color=fff&size=80`} 
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
                                        <Shield size={10} />
                                        Verified
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => {
                                setIsEditing(!isEditing);
                                if (isEditing) initializeFormData(profile);
                            }} 
                            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                                isEditing 
                                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg' 
                                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg hover:shadow-xl'
                            }`}
                        >
                            {isEditing ? <X size={16} /> : <Edit size={16} />}
                            <span className="text-sm">{isEditing ? 'Cancel' : 'Edit Profile'}</span>
                        </button>
                    </div>
                </motion.div>

                {isEditing ? (
                    // --- EDITING VIEW ---
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden"
                    >
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 sm:p-6 text-white">
                            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                                <Edit size={20} />
                                Edit Your Profile
                            </h2>
                            <p className="text-orange-100 text-xs sm:text-sm mt-1">Update your information to keep your profile current</p>
                        </div>
                        
                        <form onSubmit={handleUpdate} className="p-4 sm:p-6 space-y-6">
                            {/* Contact & Address Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-6 rounded-xl border border-orange-200">
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Phone size={18} />
                                    Contact & Address
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-gray-700">Email Address</label>
                                        <input 
                                            name="email" 
                                            type="email"
                                            value={formData.email} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-semibold text-gray-700">Phone Type</label>
                                            <select 
                                                name="phoneType" 
                                                value={formData.phoneType} 
                                                onChange={handleChange} 
                                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                            >
                                                <option>Smartphone</option>
                                                <option>Feature Phone</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-xs font-semibold text-gray-700">City</label>
                                            <input 
                                                name="city" 
                                                value={formData.city} 
                                                onChange={handleChange} 
                                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-xs font-semibold text-gray-700">Pincode</label>
                                            <input 
                                                name="pincode" 
                                                value={formData.pincode} 
                                                onChange={handleChange} 
                                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-700">Locality / Area</label>
                                            <input 
                                                name="locality" 
                                                value={formData.locality} 
                                                onChange={handleChange} 
                                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Professional Info Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-6 rounded-xl border border-orange-200">
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Briefcase size={18} />
                                    Professional Information
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-semibold text-gray-700">Overall Experience</label>
                                            <select 
                                                name="overallExperience" 
                                                value={formData.overallExperience} 
                                                onChange={handleChange} 
                                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                            >
                                                <option>Beginner</option>
                                                <option>Intermediate</option>
                                                <option>Expert</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-xs font-semibold text-gray-700">Years of Experience</label>
                                            <input 
                                                type="number" 
                                                name="experience" 
                                                value={formData.experience} 
                                                onChange={handleChange} 
                                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                            />
                                        </div>
                                        <div className="sm:col-span-2 space-y-2">
                                            <label className="block text-xs font-semibold text-gray-700">Education</label>
                                            <input 
                                                name="education" 
                                                value={formData.education} 
                                                placeholder="e.g., 10th Pass, ITI Diploma, Graduate" 
                                                onChange={handleChange} 
                                                className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Skills Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-6 rounded-xl border border-orange-200">
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Award size={18} />
                                    Skills & Proficiency
                                </h3>
                                <div className="space-y-3">
                                    {skillsData.map((skill, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row gap-2 bg-white p-3 rounded-xl border border-orange-100">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-semibold text-gray-500">Skill Name</label>
                                                <input
                                                    type="text"
                                                    value={skill.name}
                                                    onChange={(e) => handleSkillChange(index, 'name', e.target.value)}
                                                    placeholder="e.g., Plumbing"
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-semibold text-gray-500">Proficiency</label>
                                                <select
                                                    value={skill.proficiency}
                                                    onChange={(e) => handleSkillChange(index, 'proficiency', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                                >
                                                    <option>Beginner</option>
                                                    <option>Medium</option>
                                                    <option>High</option>
                                                </select>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => removeSkill(index)} 
                                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors self-end sm:self-center"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        type="button" 
                                        onClick={addSkill} 
                                        className="w-full border-2 border-dashed border-orange-400 text-orange-600 py-2.5 rounded-xl hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
                                    >
                                        <Plus size={16} />
                                        Add New Skill
                                    </button>
                                </div>
                            </div>
                            
                            {/* References Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-6 rounded-xl border border-orange-200">
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Users size={18} />
                                    References
                                </h3>
                                <div className="space-y-3">
                                    {referencesData.map((ref, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row gap-2 bg-white p-3 rounded-xl border border-orange-100">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-semibold text-gray-500">Reference Name</label>
                                                <input
                                                    type="text"
                                                    value={ref.name}
                                                    onChange={(e) => handleReferenceChange(index, 'name', e.target.value)}
                                                    placeholder="Name"
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-semibold text-gray-500">Contact</label>
                                                <input
                                                    type="text"
                                                    value={ref.contact}
                                                    onChange={(e) => handleReferenceChange(index, 'contact', e.target.value)}
                                                    placeholder="Mobile or Email"
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => removeReference(index)} 
                                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors self-end sm:self-center"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        type="button" 
                                        onClick={addReference} 
                                        className="w-full border-2 border-dashed border-orange-400 text-orange-600 py-2.5 rounded-xl hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
                                    >
                                        <Plus size={16} />
                                        Add Reference
                                    </button>
                                </div>
                            </div>
                            
                            {/* Emergency Contact Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-6 rounded-xl border border-orange-200">
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Shield size={18} />
                                    Emergency Contact
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-gray-700">Contact Name</label>
                                        <input 
                                            name="emergencyContactName" 
                                            value={formData.emergencyContactName} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl bg-white text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-gray-700">Contact Mobile</label>
                                        <input 
                                            name="emergencyContactMobile" 
                                            type="tel"
                                            value={formData.emergencyContactMobile} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-2.5 border-2 border-orange-200 rounded-xl bg-white text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Documents Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-6 rounded-xl border border-orange-200">
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Camera size={18} />
                                    Documents & Photos
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-gray-700">Profile Photo</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-4 text-center hover:border-orange-400 transition-colors bg-white">
                                            <Camera size={24} className="text-orange-500 mx-auto mb-2" />
                                            <input type="file" name="photo" onChange={handleFileChange} className="hidden" id="photo-upload" accept="image/*" />
                                            <label htmlFor="photo-upload" className="cursor-pointer">
                                                <div className="text-orange-600 font-semibold text-sm">Upload Photo</div>
                                                <p className="text-xs text-gray-500 mt-1">JPG, PNG (Max 5MB)</p>
                                            </label>
                                            {files.photo && <p className="text-xs text-green-600 mt-2">✓ {files.photo.name}</p>}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-gray-700">Certificates</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-4 text-center hover:border-orange-400 transition-colors bg-white">
                                            <Upload size={24} className="text-orange-500 mx-auto mb-2" />
                                            <input type="file" name="otherCertificates" multiple onChange={handleFileChange} className="hidden" id="certificates-upload" accept="image/*,.pdf" />
                                            <label htmlFor="certificates-upload" className="cursor-pointer">
                                                <div className="text-orange-600 font-semibold text-sm">Upload Files</div>
                                                <p className="text-xs text-gray-500 mt-1">Multiple files allowed</p>
                                            </label>
                                            {files.otherCertificates?.length > 0 && (
                                                <p className="text-xs text-green-600 mt-2">✓ {files.otherCertificates.length} file(s)</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button 
                                    type="submit" 
                                    disabled={uploading}
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 shadow-lg disabled:opacity-50 flex items-center gap-2"
                                >
                                    {uploading ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    <span>{uploading ? 'Saving...' : 'Save Changes'}</span>
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    // --- READ-ONLY VIEW ---
                    <div className="space-y-4 sm:space-y-6">
                        {/* Stats Overview - Mobile Optimized Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <StatCard 
                                title="Reputation" 
                                value={profile.points || "85"} 
                                subtitle="Excellent" 
                                icon={Star}
                                gradient="from-orange-500 to-amber-500"
                                delay={0}
                            />
                            <StatCard 
                                title="Jobs Done" 
                                value={profile.completedJobs || "24"} 
                                subtitle="This year" 
                                icon={CheckCircle}
                                gradient="from-green-500 to-emerald-600"
                                delay={0.1}
                            />
                            <StatCard 
                                title="Response" 
                                value="2.4h" 
                                subtitle="Average" 
                                icon={Clock}
                                gradient="from-blue-500 to-cyan-600"
                                delay={0.2}
                            />
                            <StatCard 
                                title="Success" 
                                value="92%" 
                                subtitle="Rate" 
                                icon={Award}
                                gradient="from-purple-500 to-pink-600"
                                delay={0.3}
                            />
                        </div>

                        {/* Section Navigation - Mobile Friendly Tabs */}
                        <div className="bg-white rounded-xl p-1 flex gap-1 overflow-x-auto scrollbar-hide shadow-sm">
                            {sections.map(section => (
                                <SectionButton
                                    key={section.id}
                                    id={section.id}
                                    label={section.label}
                                    icon={section.icon}
                                    active={activeSection}
                                />
                            ))}
                        </div>

                        {/* Personal Information Section */}
                        {activeSection === 'personal' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <User size={18} />
                                    Personal Information
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    <DetailItem label="Mobile Number" value={profile.mobile} icon={Phone} />
                                    <DetailItem label="Email Address" value={profile.email} icon={Mail} />
                                    <DetailItem label="Date of Birth" value={profile.dob ? new Date(profile.dob).toLocaleDateString() : 'Not provided'} icon={Calendar} />
                                    <DetailItem label="Gender" value={profile.gender || 'Not specified'} icon={User} />
                                    <DetailItem label="City" value={profile.address?.city} icon={MapPin} />
                                    <DetailItem label="Pincode" value={profile.address?.pincode} icon={MapPin} />
                                    <DetailItem label="Locality" value={profile.address?.locality} icon={Home} />
                                    <DetailItem label="Phone Type" value={profile.phoneType} icon={Smartphone} />
                                </div>
                            </motion.div>
                        )}

                        {/* Professional Information Section */}
                        {activeSection === 'professional' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Briefcase size={18} />
                                    Professional Information
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
                                    <DetailItem label="Experience Level" value={profile.overallExperience} icon={Award} />
                                    <DetailItem label="Years Experience" value={`${profile.experience || 0} years`} icon={Clock} />
                                    <DetailItem label="Education" value={profile.education || 'Not specified'} icon={BookOpen} />
                                    <DetailItem label="Status" value="Active" icon={Shield} color="text-green-600" />
                                </div>
                                
                                {/* Emergency Contact */}
                                <div className="mt-6 pt-4 border-t border-orange-100">
                                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                        <Shield size={16} className="text-orange-500" />
                                        Emergency Contact
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <DetailItem label="Contact Name" value={profile.emergencyContact?.name} icon={User} />
                                        <DetailItem label="Contact Mobile" value={profile.emergencyContact?.mobile} icon={Phone} />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Skills Section */}
                        {activeSection === 'skills' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Award size={18} />
                                    Skills & Expertise
                                </h3>
                                {profile.skills?.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 sm:gap-3">
                                        {profile.skills.map((skill, idx) => (
                                            <motion.div 
                                                key={skill.name} 
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 rounded-xl border border-orange-200 shadow-sm hover:shadow-md transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-800 text-sm">{skill.name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        skill.proficiency === 'High' ? 'bg-green-100 text-green-700' :
                                                        skill.proficiency === 'Medium' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {skill.proficiency}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm text-center py-8">No skills added yet</p>
                                )}
                            </motion.div>
                        )}

                        {/* References Section */}
                        {activeSection === 'references' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <Users size={18} />
                                    Professional References
                                </h3>
                                {profile.references?.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {profile.references.map((ref, idx) => (
                                            <motion.div 
                                                key={idx}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className="bg-gradient-to-r from-orange-50 to-amber-50 p-3 rounded-xl border border-orange-100"
                                            >
                                                <p className="font-semibold text-gray-800 text-sm">{ref.name}</p>
                                                <p className="text-xs text-gray-600 mt-1 break-words">{ref.contact}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm text-center py-8">No references provided</p>
                                )}
                            </motion.div>
                        )}

                        {/* Documents Section */}
                        {activeSection === 'documents' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 sm:p-6"
                            >
                                <h3 className="text-base sm:text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                                    <FileText size={18} />
                                    Certificates & Documents
                                </h3>
                                {profile.certificates?.length > 0 ? (
                                    <div className="space-y-2">
                                        {profile.certificates.map((cert, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText size={16} className="text-orange-500 flex-shrink-0" />
                                                    <span className="text-sm text-gray-700 truncate">{cert.name || `Certificate ${idx + 1}`}</span>
                                                </div>
                                                <a href={getImageUrl(cert.url)} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700">
                                                    <ExternalLink size={16} />
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm text-center py-8">No documents uploaded yet</p>
                                )}
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ViewProfile;