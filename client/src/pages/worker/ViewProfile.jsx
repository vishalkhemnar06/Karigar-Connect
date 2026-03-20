import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { 
    User, Edit, Save, X, Mail, Phone, MapPin, Calendar, 
    Award, Briefcase, BookOpen, Shield, Download, Camera,
    Star, CheckCircle, Clock, Award as AwardIcon, Plus, Trash2 
} from 'lucide-react';

const ViewProfile = () => {
    // Base URL for image paths, typically stored in environment variables
    const BASE_URL = 'http://localhost:5000/'; 

    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [skillsData, setSkillsData] = useState([]); // Array for complex skill objects
    const [referencesData, setReferencesData] = useState([]); // Array for references
    const [files, setFiles] = useState({ photo: null, otherCertificates: [] });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Helper to initialize form data from fetched profile data
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
        // Initialize complex arrays
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

    // --- Skills Management Functions ---
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

    // --- References Management Functions ---
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
        
        // CRITICAL: Stringify complex arrays for the backend's `req.body` processing
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
            fetchProfile(); // Re-fetch to display updated data
        } catch (error) {
            // Error handling for nested properties
            const errorMessage = error.response?.data?.message || 'Failed to update profile. Check console for details.';
            console.error("Update error:", error.response?.data || error);
            toast.error(errorMessage, { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    const DetailItem = ({ label, value, icon: Icon, color = "text-orange-600" }) => (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-100 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
                <div className={`p-2 bg-orange-100 rounded-lg ${color}`}>
                    <Icon size={18} />
                </div>
                <div className="flex-1">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">{label}</p>
                    <p className="text-gray-800 font-medium mt-1">{value || 'Not provided'}</p>
                </div>
            </div>
        </div>
    );

    const StatCard = ({ title, value, subtitle, icon: Icon, gradient }) => (
        <div className={`bg-gradient-to-r ${gradient} p-4 rounded-xl text-white shadow-lg`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm opacity-90">{title}</p>
                    <p className="text-2xl font-bold mt-1">{value}</p>
                    {subtitle && <p className="text-xs opacity-80 mt-1">{subtitle}</p>}
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                    <Icon size={24} />
                </div>
            </div>
        </div>
    );

    if (loading) return (
        <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading your profile...</p>
            </div>
        </div>
    );
    
    if (!profile) return (
        <div className="text-center p-10 bg-white rounded-xl shadow-sm border border-orange-200">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={32} className="text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h3>
            <p className="text-gray-600">Could not load profile data. Please try again.</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-6 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <img 
                                    src={profile.photo ? getImageUrl(profile.photo) : `https://ui-avatars.com/api/?name=${profile.name}&background=fb923c&color=fff`} 
                                    alt={profile.name} 
                                    className="w-20 h-20 rounded-2xl object-cover border-4 border-orange-200 shadow-lg"
                                />
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                    <CheckCircle size={12} className="text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{profile.name}</h1>
                                <div className="flex items-center space-x-3 mt-2">
                                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-semibold">
                                        {profile.karigarId}
                                    </span>
                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                                        <Shield size={14} className="mr-1" />
                                        Verified
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => {
                                setIsEditing(!isEditing);
                                // Reset form data to current profile data when canceling edit
                                if (isEditing) initializeFormData(profile);
                            }} 
                            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                                isEditing 
                                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg' 
                                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg hover:shadow-xl'
                            }`}
                        >
                            {isEditing ? <><X size={18}/><span>Cancel Edit</span></> : <><Edit size={18}/><span>Update Profile</span></>}
                        </button>
                    </div>
                </div>

                {isEditing ? (
                    // --- EDITING VIEW ---
                    <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
                            <h2 className="text-2xl font-bold flex items-center">
                                <Edit size={24} className="mr-3" />
                                Edit Your Profile
                            </h2>
                            <p className="text-orange-100 mt-1">Update your information to keep your profile current</p>
                        </div>
                        
                        <form onSubmit={handleUpdate} className="p-6 space-y-8">
                            {/* Contact & Address Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
                                <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center">
                                    <Phone size={20} className="mr-2" />
                                    Contact & Address Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Email Address</label>
                                        <input 
                                            name="email" 
                                            type="email"
                                            value={formData.email} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Phone Type</label>
                                        <select 
                                            name="phoneType" 
                                            value={formData.phoneType} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        >
                                            <option>Smartphone</option>
                                            <option>Feature Phone</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">City</label>
                                        <input 
                                            name="city" 
                                            value={formData.city} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Pincode</label>
                                        <input 
                                            name="pincode" 
                                            value={formData.pincode} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Locality / Area</label>
                                        <input 
                                            name="locality" 
                                            value={formData.locality} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Professional Info Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
                                <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center">
                                    <Briefcase size={20} className="mr-2" />
                                    Professional Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Overall Experience</label>
                                        <select 
                                            name="overallExperience" 
                                            value={formData.overallExperience} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        >
                                            <option>Beginner</option>
                                            <option>Intermediate</option>
                                            <option>Expert</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Years of Experience</label>
                                        <input 
                                            type="number" 
                                            name="experience" 
                                            value={formData.experience} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Education</label>
                                        <input 
                                            name="education" 
                                            value={formData.education} 
                                            placeholder="e.g., 10th Pass, ITI Diploma, Graduate" 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Skills Section (Dynamic) */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
                                <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center">
                                    <Award size={20} className="mr-2" />
                                    Skills & Proficiency
                                </h3>
                                <div className="space-y-4">
                                    {skillsData.map((skill, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row gap-3 items-end p-3 bg-white border border-orange-100 rounded-lg">
                                            <div className="flex-1 w-full space-y-2">
                                                <label className="block text-xs font-semibold text-gray-600">Skill Name</label>
                                                <input
                                                    type="text"
                                                    value={skill.name}
                                                    onChange={(e) => handleSkillChange(index, 'name', e.target.value)}
                                                    placeholder="e.g., Plumbing, Welding"
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                            <div className="flex-1 w-full space-y-2">
                                                <label className="block text-xs font-semibold text-gray-600">Proficiency</label>
                                                <select
                                                    value={skill.proficiency}
                                                    onChange={(e) => handleSkillChange(index, 'proficiency', e.target.value)}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                                                >
                                                    <option>Beginner</option>
                                                    <option>Medium</option>
                                                    <option>High</option>
                                                </select>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => removeSkill(index)} 
                                                className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors flex-shrink-0"
                                                title="Remove Skill"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        type="button" 
                                        onClick={addSkill} 
                                        className="w-full border-2 border-dashed border-orange-400 text-orange-600 py-3 rounded-xl hover:bg-orange-50 transition-colors flex items-center justify-center space-x-2 font-semibold"
                                    >
                                        <Plus size={20} />
                                        <span>Add New Skill</span>
                                    </button>
                                </div>
                            </div>
                            
                            {/* References Section (Dynamic) */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
                                <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center">
                                    <User size={20} className="mr-2" />
                                    References (Optional)
                                </h3>
                                <div className="space-y-4">
                                    {referencesData.map((ref, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row gap-3 items-end p-3 bg-white border border-orange-100 rounded-lg">
                                            <div className="flex-1 w-full space-y-2">
                                                <label className="block text-xs font-semibold text-gray-600">Reference Name</label>
                                                <input
                                                    type="text"
                                                    value={ref.name}
                                                    onChange={(e) => handleReferenceChange(index, 'name', e.target.value)}
                                                    placeholder="Name"
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                            <div className="flex-1 w-full space-y-2">
                                                <label className="block text-xs font-semibold text-gray-600">Contact (Mobile/Email)</label>
                                                <input
                                                    type="text"
                                                    value={ref.contact}
                                                    onChange={(e) => handleReferenceChange(index, 'contact', e.target.value)}
                                                    placeholder="Mobile or Email"
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => removeReference(index)} 
                                                className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors flex-shrink-0"
                                                title="Remove Reference"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        type="button" 
                                        onClick={addReference} 
                                        className="w-full border-2 border-dashed border-orange-400 text-orange-600 py-3 rounded-xl hover:bg-orange-50 transition-colors flex items-center justify-center space-x-2 font-semibold"
                                    >
                                        <Plus size={20} />
                                        <span>Add New Reference</span>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Emergency Contact Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
                                <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center">
                                    <Shield size={20} className="mr-2" />
                                    Emergency Contact
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Contact Name</label>
                                        <input 
                                            name="emergencyContactName" 
                                            value={formData.emergencyContactName} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">Contact Mobile</label>
                                        <input 
                                            name="emergencyContactMobile" 
                                            type="tel"
                                            value={formData.emergencyContactMobile} 
                                            onChange={handleChange} 
                                            className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Documents Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
                                <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center">
                                    <AwardIcon size={20} className="mr-2" />
                                    Documents & Photos
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-gray-700">Update Profile Photo</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-6 text-center hover:border-orange-400 transition-colors bg-white">
                                            <Camera size={24} className="text-orange-500 mx-auto mb-2" />
                                            <input 
                                                type="file" 
                                                name="photo" 
                                                onChange={handleFileChange} 
                                                className="hidden" 
                                                id="photo-upload"
                                                accept="image/*"
                                            />
                                            <label htmlFor="photo-upload" className="cursor-pointer">
                                                <div className="text-orange-600 font-semibold mb-1">Upload New Photo</div>
                                                <p className="text-sm text-gray-600">JPG, PNG (Max 5MB)</p>
                                            </label>
                                            {files.photo && (
                                                <p className="text-sm text-green-600 mt-2">
                                                    ✓ {files.photo.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-gray-700">Add Other Certificates</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-6 text-center hover:border-orange-400 transition-colors bg-white">
                                            <Download size={24} className="text-orange-500 mx-auto mb-2" />
                                            <input 
                                                type="file" 
                                                name="otherCertificates" 
                                                multiple 
                                                onChange={handleFileChange} 
                                                className="hidden" 
                                                id="certificates-upload"
                                                accept="image/*,.pdf"
                                            />
                                            <label htmlFor="certificates-upload" className="cursor-pointer">
                                                <div className="text-orange-600 font-semibold mb-1">Upload Certificates</div>
                                                <p className="text-sm text-gray-600">Multiple files allowed (Max 5MB each)</p>
                                            </label>
                                            {files.otherCertificates?.length > 0 && (
                                                <p className="text-sm text-green-600 mt-2">
                                                    ✓ {files.otherCertificates.length} file(s) selected
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button 
                                    type="submit" 
                                    disabled={uploading}
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
                    </div>
                ) : (
                    // --- READ-ONLY VIEW ---
                    <div className="space-y-6">
                        {/* Stats Overview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard 
                                title="Reputation Score" 
                                value={profile.points || "85"} 
                                subtitle="Excellent" 
                                icon={Star}
                                gradient="from-orange-500 to-amber-500"
                            />
                            <StatCard 
                                title="Jobs Completed" 
                                value="24" 
                                subtitle="This year" 
                                icon={CheckCircle}
                                gradient="from-green-500 to-emerald-600"
                            />
                            <StatCard 
                                title="Response Time" 
                                value="2.4h" 
                                subtitle="Average" 
                                icon={Clock}
                                gradient="from-blue-500 to-cyan-600"
                            />
                            <StatCard 
                                title="Success Rate" 
                                value="92%" 
                                subtitle="Client satisfaction" 
                                icon={Award}
                                gradient="from-purple-500 to-pink-600"
                            />
                        </div>

                        {/* Personal Information */}
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-6">
                            <h3 className="text-xl font-semibold text-orange-800 mb-6 flex items-center">
                                <User size={20} className="mr-2" />
                                Personal Information
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <DetailItem label="Mobile Number" value={profile.mobile} icon={Phone} />
                                <DetailItem label="Email Address" value={profile.email} icon={Mail} />
                                <DetailItem label="Date of Birth" value={new Date(profile.dob).toLocaleDateString()} icon={Calendar} />
                                <DetailItem label="Gender" value={profile.gender} icon={User} />
                                <DetailItem label="City" value={profile.address?.city} icon={MapPin} />
                                <DetailItem label="Pincode" value={profile.address?.pincode} icon={MapPin} />
                                <DetailItem label="Locality" value={profile.address?.locality} icon={MapPin} />
                                <DetailItem label="Phone Type" value={profile.phoneType} icon={Phone} />
                            </div>
                        </div>

                        {/* Professional Information */}
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-6">
                            <h3 className="text-xl font-semibold text-orange-800 mb-6 flex items-center">
                                <Briefcase size={20} className="mr-2" />
                                Professional Information
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <DetailItem label="Overall Experience" value={profile.overallExperience} icon={Award} />
                                <DetailItem label="Years of Experience" value={`${profile.experience} years`} icon={Clock} />
                                <DetailItem label="Education" value={profile.education} icon={BookOpen} />
                                <DetailItem label="Status" value="Active" icon={Shield} color="text-green-600" />
                            </div>
                            
                            {/* Skills Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
                                <h4 className="text-lg font-semibold text-orange-800 mb-4">Skills & Expertise</h4>
                                <div className="flex flex-wrap gap-3">
                                    {profile.skills?.length > 0 ? profile.skills.map(skill => (
                                        <div 
                                            key={skill.name} 
                                            className="bg-white px-4 py-3 rounded-xl border border-orange-200 shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <span className="font-semibold text-gray-800">{skill.name}</span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    skill.proficiency === 'High' ? 'bg-green-100 text-green-800' :
                                                    skill.proficiency === 'Medium' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-blue-100 text-blue-800'
                                                }`}>
                                                    {skill.proficiency}
                                                </span>
                                            </div>
                                        </div>
                                    )) : <p className="text-gray-500">No skills added yet.</p>}
                                </div>
                            </div>

                            {/* References Section (Read-only) */}
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-6 mt-6">
                                <h3 className="text-xl font-semibold text-orange-800 mb-6 flex items-center">
                                    <User size={20} className="mr-2" />
                                    References
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {profile.references?.length > 0 ? profile.references.map((ref, index) => (
                                        <div key={index} className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                            <p className="font-semibold text-gray-800">{ref.name}</p>
                                            <p className="text-sm text-gray-600">{ref.contact}</p>
                                        </div>
                                    )) : <p className="text-gray-500">No professional references provided.</p>}
                                </div>
                            </div>

                            {/* Emergency Contact Section (Read-only) */}
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-6 mt-6">
                                <h3 className="text-xl font-semibold text-orange-800 mb-6 flex items-center">
                                    <Shield size={20} className="mr-2" />
                                    Emergency Contact
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <DetailItem label="Emergency Contact Name" value={profile.emergencyContact?.name} icon={User} />
                                    <DetailItem label="Emergency Contact Mobile" value={profile.emergencyContact?.mobile} icon={Phone} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ViewProfile;