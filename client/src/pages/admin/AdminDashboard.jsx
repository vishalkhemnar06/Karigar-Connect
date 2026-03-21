// src/pages/admin/AdminDashboard.jsx — UPDATED
// Changes from previous version:
//   - Sidebar "Worker Complaints" navigates to /admin/worker-complaints (was /admin/complaints)
//   - Header action bar "Worker Complaints" button navigates to /admin/worker-complaints
//   - "Complaints" button (client complaints) kept at /admin/complaints — unchanged
//   - All original code preserved exactly

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.jpg';
import {
    Check, X, ShieldX, Trash2, Eye, Users, UserCheck,
    UserX, Clock, ShieldCheck, Search, Filter, Download,
    ChevronDown, ChevronUp, Home, Mail, Phone, MapPin,
    FileText, Image, Award, Briefcase, AlertCircle, AlertTriangle,
    LogOut, Menu, X as CloseIcon, Calendar, Smartphone,
    Shield, MapPin as MapPinIcon, FileText as FileTextIcon,
    Camera, Upload, Award as AwardIcon, Star, MessageSquare
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// --- Modal Component to Verify Worker & Assign Points ---
const VerificationModal = ({ worker, onClose, onConfirm }) => {
    const [points, setPoints] = useState(10);
    const [feedback, setFeedback] = useState('');

    if (!worker) return null;

    const experience = worker.experience || 0;
    const finalScore = Number(points) + (experience * 10);

    const handleSubmit = () => {
        if (points < 1 || points > 50) {
            toast.error("Please assign points between 1 and 50.");
            return;
        }
        onConfirm(worker._id, 'approved', points, feedback);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-orange-600 to-amber-500 p-5 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold">Verify Profile</h3>
                        <p className="text-orange-100 text-xs">Reviewing: {worker.name}</p>
                    </div>
                    <button onClick={onClose} className="hover:rotate-90 transition-transform"><CloseIcon size={24}/></button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Star size={16} className="text-orange-500" /> Assign Base Points (1 - 50)
                        </label>
                        <input
                            type="number"
                            min="1" max="50"
                            value={points}
                            onChange={(e) => setPoints(e.target.value)}
                            className="w-full border-2 border-orange-100 rounded-xl p-3 text-2xl font-black text-orange-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                        />
                    </div>

                    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                        <div className="flex justify-between text-xs font-bold text-orange-800 uppercase tracking-widest mb-2">
                            <span>Calculation Logic</span>
                            <span className="text-orange-500">Leaderboard Beta</span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-700">
                            <div className="flex justify-between">
                                <span>Admin Points:</span>
                                <span className="font-mono">+{points || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Experience Bonus ({experience} yrs):</span>
                                <span className="font-mono">+{experience * 10}</span>
                            </div>
                            <div className="border-t border-orange-200 mt-2 pt-2 flex justify-between font-black text-lg text-orange-900">
                                <span>Final Ranking Score:</span>
                                <span>{finalScore}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Internal Admin Feedback</label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Add internal notes about background check or skill level..."
                            className="w-full border-2 border-gray-100 rounded-xl p-3 h-28 focus:border-orange-500 outline-none text-sm transition-all"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all"
                    >
                        APPROVE & ACTIVATE ID
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Modal Component to View User Details ---
const UserDetailsModal = ({ user, onClose, baseURL }) => {
    if (!user) return null;

    const address   = user.address || {};
    const emergency = user.emergencyContact || {};
    const idDoc     = user.idProof || {};

    const resolvePath = (value) => {
        if (!value) return null;
        const raw = typeof value === 'string' ? value : (value.filePath || value.path || null);
        if (!raw) return null;
        return raw.startsWith('http') ? raw : `${baseURL}${String(raw).replace(/^\//, '')}`;
    };

    const DetailItem = ({ label, value, icon: Icon }) => (
        <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
            {Icon && <Icon size={18} className="text-orange-500 mt-0.5 flex-shrink-0" />}
            <div className="flex-1">
                <p className="font-semibold text-orange-600 text-xs uppercase tracking-wider">{label}</p>
                <p className="text-gray-800 text-sm mt-1">{value || 'N/A'}</p>
            </div>
        </div>
    );

    const FileLink = ({ path, label, icon: Icon }) => (
        resolvePath(path) ? (
            <a href={resolvePath(path)} target="_blank" rel="noopener noreferrer" className="flex items-center text-orange-600 hover:text-orange-800 text-sm p-2 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors">
                {Icon && <Icon size={16} className="mr-2" />}
                {label}
            </a>
        ) : <span className="text-gray-400 text-sm">Not Provided</span>
    );

    const renderSkills = (skills) => {
        if (!skills || !Array.isArray(skills)) return 'N/A';
        return skills.map(skill => {
            if (typeof skill === 'object') return `${skill.name} (${skill.proficiency})`;
            return skill;
        }).join(', ');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 p-4 sm:p-6 rounded-t-xl flex justify-between items-center z-10">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <img
                            src={user.photo ? (user.photo.startsWith('http') ? user.photo : baseURL + user.photo) : '/default-avatar.png'}
                            alt={user.name}
                            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-4 border-white/20 shadow-lg"
                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                        />
                        <div className="text-white">
                            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold">{user.name}</h3>
                            <p className="text-orange-100 text-sm">{user.karigarId} | {user.role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white text-2xl sm:text-3xl hover:text-orange-200 transition-colors">&times;</button>
                </div>

                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
                    {/* Personal & Contact */}
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 sm:p-5 rounded-xl border border-orange-100">
                        <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-orange-800 flex items-center">
                            <UserCheck size={18} className="mr-2" /> Personal & Contact Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <DetailItem label="Full Name"      value={user.name}                                                    icon={UserCheck} />
                            <DetailItem label="Date of Birth"  value={user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A'} icon={Calendar} />
                            <DetailItem label="Phone Type"     value={user.phoneType || 'N/A'}                                      icon={Smartphone} />
                            <DetailItem label="Gender"         value={user.gender} />
                            <DetailItem label="Mobile"         value={user.mobile}                                                  icon={Phone} />
                            <DetailItem label="Email"          value={user.email}                                                   icon={Mail} />
                            <DetailItem label="Aadhar Number"  value={user.aadharNumber} />
                            <DetailItem label="E-Shram Number" value={user.eShramNumber || 'N/A'} />
                        </div>
                    </div>

                    {/* Address */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5 rounded-xl border border-amber-100">
                        <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-amber-800 flex items-center">
                            <MapPinIcon size={18} className="mr-2" /> Address Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <DetailItem label="City"         value={address.city     || user.city}     icon={Home} />
                            <DetailItem label="Pincode"      value={address.pincode  || user.pincode} />
                            <DetailItem label="Locality/Area" value={address.locality || user.locality} />
                        </div>
                    </div>

                    {/* Worker Specific */}
                    {user.role === 'worker' && (
                        <>
                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 sm:p-5 rounded-xl border border-yellow-100">
                                <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-amber-800 flex items-center">
                                    <Briefcase size={18} className="mr-2" /> Professional Details
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <DetailItem label="Overall Experience" value={user.overallExperience} />
                                    <DetailItem label="Years of Experience" value={user.experience ? `${user.experience} years` : 'N/A'} />
                                    <div className="sm:col-span-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase tracking-wider mb-2">Skills & Proficiency</p>
                                        <div className="bg-white p-3 rounded-lg border border-orange-100">
                                            <p className="text-sm text-gray-800">{renderSkills(user.skills)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 sm:p-5 rounded-xl border border-red-100">
                                <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-red-800 flex items-center">
                                    <AlertCircle size={18} className="mr-2" /> Emergency & References
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <DetailItem label="Emergency Contact Name"   value={emergency.name   || user.emergencyContactName} />
                                    <DetailItem label="Emergency Contact Mobile" value={emergency.mobile || user.emergencyContactMobile} />
                                    <div className="sm:col-span-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase tracking-wider mb-2">References</p>
                                        <div className="space-y-2">
                                            {user.references?.length > 0 ? user.references.map((ref, i) => (
                                                <div key={i} className="bg-white p-2 sm:p-3 rounded-lg border border-orange-100">
                                                    <p className="text-sm font-medium">{ref.name}</p>
                                                    <p className="text-xs text-gray-600">{ref.contact}</p>
                                                </div>
                                            )) : <p className="text-sm text-gray-500">No references provided</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Client Specific */}
                    {user.role === 'client' && (
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 sm:p-5 rounded-xl border border-orange-100">
                            <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-orange-800 flex items-center">
                                <Briefcase size={18} className="mr-2" /> Additional Information
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <DetailItem label="Workplace/Profession" value={user.workplaceInfo || 'N/A'} />
                                <DetailItem label="Social Profile" value={user.socialProfile ? <a href={user.socialProfile} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">View Profile</a> : 'N/A'} />
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    <div className="bg-gradient-to-r from-gray-50 to-orange-50 p-4 sm:p-5 rounded-xl border border-gray-100">
                        <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-gray-800 flex items-center">
                            <FileTextIcon size={18} className="mr-2" /> Documents & Uploads
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-2">
                                <p className="font-semibold text-orange-600 text-xs uppercase">Profile Photo</p>
                                <FileLink path={user.photo} label="View Photo" icon={Camera} />
                            </div>
                            <div className="space-y-2">
                                <p className="font-semibold text-orange-600 text-xs uppercase">ID Proof ({idDoc.idType || user.idDocumentType || 'Aadhar Card'})</p>
                                <FileLink path={idDoc.filePath || user.idProof} label="View ID Proof" icon={FileText} />
                            </div>
                            {user.role === 'worker' && (
                                <>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">E-Shram Card</p>
                                        <FileLink path={user.eShramCardPath || user.eShramCard} label="View E-Shram Card" icon={FileText} />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Live Face Photo</p>
                                        <FileLink path={user.liveFacePhoto} label="View Live Face" icon={Camera} />
                                        <p className="text-xs text-gray-600 mt-1">Similarity: {typeof user.faceVerificationScore === 'number' ? user.faceVerificationScore.toFixed(3) : 'N/A'} | Status: {user.faceVerificationStatus || 'N/A'}</p>
                                    </div>
                                    <div className="sm:col-span-2 space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Skill Certificates</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {user.skillCertificates?.length > 0 ? user.skillCertificates.map((cert, i) => (
                                                <FileLink key={i} path={cert} label={`Certificate ${i+1}`} icon={AwardIcon} />
                                            )) : <span className="text-gray-400 text-sm">Not Provided</span>}
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2 space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Portfolio Photos</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {user.portfolioPhotos?.length > 0 ? user.portfolioPhotos.map((photo, i) => (
                                                <FileLink key={i} path={photo} label={`Photo ${i+1}`} icon={Image} />
                                            )) : <span className="text-gray-400 text-sm">Not Provided</span>}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-orange-50 p-3 sm:p-4 border-t border-orange-100 rounded-b-xl flex justify-end space-x-2 sm:space-x-3">
                    <button onClick={onClose} className="px-4 sm:px-6 py-2 bg-orange-200 text-orange-800 rounded-lg hover:bg-orange-300 transition-colors font-medium text-sm sm:text-base">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Header Component ---
const DashboardHeader = ({ onLogout, onMenuToggle, isSidebarOpen }) => (
    <header className="bg-gradient-to-r from-orange-600 to-orange-300 shadow-lg sticky top-0 z-40">
        <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center space-x-3 sm:space-x-4">
                <button
                    onClick={onMenuToggle}
                    className="lg:hidden p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                >
                    {isSidebarOpen ? <CloseIcon size={18} /> : <Menu size={18} />}
                </button>
                <div className="flex items-center space-x-2 sm:space-x-3">
                    <img src={logo} alt="KarigarConnect Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white/50" />
                    <div className="hidden sm:block">
                        <h1 className="text-lg sm:text-xl font-bold text-white">KarigarConnect</h1>
                        <p className="text-orange-100 text-xs sm:text-sm">Admin Portal</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
                <span className="text-white font-medium hidden sm:block">Welcome, Admin</span>
                <button
                    onClick={onLogout}
                    className="group flex items-center space-x-1 sm:space-x-2 bg-white/20 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-white/30 transition-all duration-200 ease-in-out hover:shadow-lg text-sm sm:text-base"
                >
                    <LogOut size={16} className="sm:mr-1" />
                    <span className="hidden sm:inline">Logout</span>
                </button>
            </div>
        </div>
    </header>
);

// --- Mobile User Card ---
const MobileUserCard = ({ user, baseURL, onViewDetails, onVerifyOpen, onStatusUpdate, onDelete }) => {
    const renderStatusBadge = (status) => {
        const colors = {
            pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
            approved: 'bg-green-100 text-green-800 border-green-200',
            rejected: 'bg-red-100 text-red-800 border-red-200',
            blocked:  'bg-gray-200 text-gray-800 border-gray-300',
        };
        return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${colors[status]}`}>{status}</span>;
    };

    const renderSkills = (skills) => {
        if (!skills || !Array.isArray(skills)) return 'N/A';
        const skillNames = skills.map(skill => typeof skill === 'object' ? skill.name : skill);
        return skillNames.slice(0, 2).join(', ') + (skillNames.length > 2 ? ` +${skillNames.length - 2}` : '');
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-orange-100 p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                    <img
                        src={user.photo ? (user.photo.startsWith('http') ? user.photo : baseURL + user.photo) : '/default-avatar.png'}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-orange-100"
                        onError={(e) => { e.target.src = '/default-avatar.png'; }}
                    />
                    <div>
                        <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
                        <p className="text-xs text-gray-600 capitalize">{user.role}</p>
                    </div>
                </div>
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">{user.karigarId}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div>
                    <p className="text-gray-500">Mobile</p>
                    <p className="font-medium">{user.mobile}</p>
                </div>
                <div>
                    <p className="text-gray-500">{user.role === 'client' ? 'Email' : 'Skills'}</p>
                    <p className="font-medium truncate">
                        {user.role === 'worker' ? renderSkills(user.skills) : user.email}
                    </p>
                </div>
            </div>
            <div className="flex items-center justify-between">
                {user.role !== 'client' && <div>{renderStatusBadge(user.verificationStatus)}</div>}
                <div className="flex space-x-1">
                    <button onClick={() => onViewDetails(user)} className="p-1.5 bg-orange-100 text-orange-600 rounded hover:bg-orange-200"><Eye size={14} /></button>
                    {user.role === 'worker' && user.verificationStatus === 'pending' && (
                        <>
                            <button onClick={() => onVerifyOpen(user)} className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"><Check size={14} /></button>
                            <button onClick={() => onStatusUpdate(user._id, 'rejected')} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><X size={14} /></button>
                        </>
                    )}
                    {user.role === 'worker' && user.verificationStatus === 'approved' && (
                        <button onClick={() => onStatusUpdate(user._id, 'blocked')} className="p-1.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"><ShieldX size={14} /></button>
                    )}
                    {user.role === 'worker' && user.verificationStatus === 'blocked' && (
                        <button onClick={() => onStatusUpdate(user._id, 'unblocked')} className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"><ShieldCheck size={14} /></button>
                    )}
                    <button onClick={() => onDelete(user._id, user.name, user.role)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={14} /></button>
                </div>
            </div>
        </div>
    );
};

// --- Main Dashboard Component ---
const AdminDashboard = () => {
    const [workers, setWorkers]           = useState([]);
    const [clients, setClients]           = useState([]);
    const [loading, setLoading]           = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userToVerify, setUserToVerify] = useState(null);
    const [activeFilter, setActiveFilter] = useState('pending');
    const [searchTerm, setSearchTerm]     = useState('');
    const [sortConfig, setSortConfig]     = useState({ key: null, direction: 'asc' });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn]     = useState(true);

    const navigate = useNavigate();
    const baseURL  = 'http://localhost:5000/';

    useEffect(() => {
        if (isLoggedIn) {
            const handleBackButton = (e) => { e.preventDefault(); window.history.forward(); };
            window.history.pushState(null, null, window.location.pathname);
            window.addEventListener('popstate', handleBackButton);
            return () => { window.removeEventListener('popstate', handleBackButton); };
        }
    }, [isLoggedIn]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [workersRes, clientsRes] = await Promise.all([api.getAllWorkers(), api.getAllClients()]);
            setWorkers(workersRes.data);
            setClients(clientsRes.data);
        } catch (error) { toast.error('Failed to fetch data'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleLogout = () => {
        setIsLoggedIn(false);
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const stats = useMemo(() => ({
        totalWorkers: workers.length,
        pending:      workers.filter(w => w.verificationStatus === 'pending').length,
        approved:     workers.filter(w => w.verificationStatus === 'approved').length,
        rejected:     workers.filter(w => w.verificationStatus === 'rejected').length,
        blocked:      workers.filter(w => w.verificationStatus === 'blocked').length,
        totalClients: clients.length,
    }), [workers, clients]);

    const filteredData = useMemo(() => {
        let data = activeFilter === 'clients' ? clients : workers.filter(w => w.verificationStatus === activeFilter);
        if (searchTerm) {
            data = data.filter(user =>
                user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.mobile?.includes(searchTerm) ||
                user.karigarId?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (sortConfig.key) {
            data.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [activeFilter, workers, clients, searchTerm, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const handleStatusUpdate = async (workerId, status, points = 0, feedback = '') => {
        const toastId = toast.loading('Processing...');
        try {
            await api.updateWorkerStatus({ workerId, status, points: Number(points), rejectionReason: feedback });
            toast.success('Action successful', { id: toastId });
            setUserToVerify(null);
            fetchData();
        } catch (error) { toast.error('Failed to update', { id: toastId }); }
    };

    const handleDelete = async (userId, name, role) => {
        if (window.confirm(`Delete ${role}: ${name}?`)) {
            const toastId = toast.loading('Deleting...');
            try {
                await api.deleteUser(userId);
                toast.success('Deleted', { id: toastId });
                fetchData();
            } catch (error) { toast.error('Failed', { id: toastId }); }
        }
    };

    const exportApprovedWorkers = (format) => {
        const approvedWorkers = workers.filter(w => w.verificationStatus === 'approved');
        if (approvedWorkers.length === 0) { toast.error('No approved workers'); return; }
        if (format === 'excel') {
            const worksheetData = approvedWorkers.map(worker => ({
                'Karigar ID': worker.karigarId, 'Name': worker.name, 'Mobile': worker.mobile,
                'Score': worker.points || 0, 'Experience': worker.experience, 'City': worker.city,
            }));
            const worksheet = XLSX.utils.json_to_sheet(worksheetData);
            const workbook  = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved');
            XLSX.writeFile(workbook, 'workers.xlsx');
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.text('Approved Workers', 14, 22);
            const tableData = approvedWorkers.map(w => [w.karigarId, w.name, w.mobile, w.points || 0, w.city]);
            doc.autoTable({ startY: 30, head: [['ID', 'Name', 'Mobile', 'Score', 'City']], body: tableData });
            doc.save('workers.pdf');
        }
    };

    const renderStatusBadge = (status) => {
        const colors = {
            pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
            approved: 'bg-green-100 text-green-800 border-green-200',
            rejected: 'bg-red-100 text-red-800 border-red-200',
            blocked:  'bg-gray-200 text-gray-800 border-gray-300',
        };
        return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${colors[status]}`}>{status}</span>;
    };

    const StatCard = ({ title, value, icon: Icon, color, gradient }) => (
        <div className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${color} relative overflow-hidden group hover:shadow-md transition-shadow`}>
            <div className={`absolute top-0 right-0 w-16 h-16 opacity-10 ${gradient} rounded-full -m-4 group-hover:scale-110 transition-transform`}></div>
            <div className="relative z-10">
                <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
                <p className="text-xl lg:text-3xl font-bold text-gray-900">{value}</p>
            </div>
            <div className={`absolute bottom-4 right-4 p-2 rounded-lg ${gradient} text-white`}><Icon size={18} /></div>
        </div>
    );

    const SidebarLink = ({ filter, label, icon: Icon, count }) => (
        <button
            onClick={() => { setActiveFilter(filter); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
            className={`flex items-center w-full px-4 py-3 text-left rounded-xl transition-all group ${
                activeFilter === filter ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-600 hover:bg-orange-50'
            }`}
        >
            <Icon size={18} className={`mr-3 ${activeFilter === filter ? 'text-white' : 'text-gray-400'}`} />
            <span className="flex-1 text-sm">{label}</span>
            {count !== undefined && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${activeFilter === filter ? 'bg-white text-orange-700' : 'bg-orange-100 text-orange-700'}`}>
                    {count}
                </span>
            )}
        </button>
    );

    const SortHeader = ({ label, sortKey }) => (
        <button onClick={() => handleSort(sortKey)} className="flex items-center font-semibold text-gray-700 hover:text-orange-700 text-sm">
            {label} {sortConfig.key === sortKey && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </button>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
            {/* Modals */}
            <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} baseURL={baseURL} />
            <VerificationModal worker={userToVerify} onClose={() => setUserToVerify(null)} onConfirm={handleStatusUpdate} />

            <DashboardHeader onLogout={handleLogout} onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />

            <div className="flex">
                {/* Sidebar */}
                <aside className={`w-64 bg-white border-r h-[calc(100vh-64px)] fixed lg:sticky top-16 shadow-lg transition-transform lg:translate-x-0 z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static`}>
                    <div className="p-6">
                        <nav className="space-y-2">
                            {/* Workers */}
                            <p className="px-3 text-xs font-bold text-orange-600 uppercase mb-2">Workers</p>
                            <SidebarLink filter="pending"  label="Pending Review" icon={Clock}     count={stats.pending} />
                            <SidebarLink filter="approved" label="Approved"        icon={UserCheck} count={stats.approved} />
                            <SidebarLink filter="rejected" label="Rejected"        icon={UserX}     count={stats.rejected} />
                            <SidebarLink filter="blocked"  label="Blocked"         icon={ShieldX}   count={stats.blocked} />

                            {/* Clients */}
                            <p className="px-3 pt-6 text-xs font-bold text-orange-600 uppercase mb-2">Clients</p>
                            <SidebarLink filter="clients" label="All Clients" icon={Users} count={stats.totalClients} />

                            {/* Complaints (existing — client complaints) */}
                            <p className="px-3 pt-6 text-xs font-bold text-orange-600 uppercase mb-2">Client Complaints</p>
                            <button
                                onClick={() => { navigate('/admin/complaints'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                                className="flex items-center w-full px-4 py-3 text-left rounded-xl transition-all group text-gray-600 hover:bg-orange-50"
                            >
                                <AlertTriangle size={18} className="mr-3 text-gray-400 group-hover:text-orange-500 transition-colors" />
                                <span className="flex-1 text-sm">Client Complaints</span>
                            </button>

                            {/* Worker Complaints & Support — NEW, navigates to /admin/worker-complaints */}
                            <p className="px-3 pt-6 text-xs font-bold text-orange-600 uppercase mb-2">Worker Support</p>
                            <button
                                onClick={() => { navigate('/admin/worker-complaints'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                                className="flex items-center w-full px-4 py-3 text-left rounded-xl transition-all group text-gray-600 hover:bg-orange-50"
                            >
                                <MessageSquare size={18} className="mr-3 text-gray-400 group-hover:text-orange-500 transition-colors" />
                                <span className="flex-1 text-sm">Worker Complaints</span>
                            </button>
                            

                            {/* Community */}
                            <p className="px-3 pt-6 text-xs font-bold text-orange-600 uppercase mb-2">Community</p>
                            <button
                                onClick={() => { navigate('/admin/community'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                                className="flex items-center w-full px-4 py-3 text-left rounded-xl transition-all group text-gray-600 hover:bg-orange-50"
                            >
                                <MessageSquare size={18} className="mr-3 text-gray-400 group-hover:text-orange-500 transition-colors" />
                                <span className="flex-1 text-sm">Manage Posts</span>
                            </button>
                        </nav>
                    </div>
                </aside>

                <main className="flex-1 p-4 lg:p-6">
                    <div className="flex flex-col lg:flex-row justify-between mb-8 space-y-4 lg:space-y-0">
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Control Desk</h1>
                            <p className="text-gray-500 text-sm">Manage, verify and rank professionals</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => navigate('/admin/fraud')}
                                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
                            >
                                Fraud Monitor
                            </button>
                            {/* Client Complaints — kept at /admin/complaints */}
                            <button
                                onClick={() => navigate('/admin/complaints')}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                                <AlertTriangle size={14} />
                                Client Complaints
                            </button>
                            {/* Worker Complaints — NEW, navigates to /admin/worker-complaints */}
                            <button
                                onClick={() => navigate('/admin/worker-complaints')}
                                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors flex items-center gap-2"
                            >
                                <MessageSquare size={14} />
                                Worker Support
                            </button>
                            
                            <button
                                onClick={() => navigate('/admin/community')}
                                className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors flex items-center gap-2"
                            >
                                <MessageSquare size={14} />
                                Community
                            </button>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 w-full lg:w-64 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                        <StatCard title="Total"    value={stats.totalWorkers} icon={Users}     color="border-orange-500" gradient="bg-orange-500" />
                        <StatCard title="Pending"  value={stats.pending}      icon={Clock}     color="border-yellow-500" gradient="bg-yellow-500" />
                        <StatCard title="Approved" value={stats.approved}     icon={UserCheck} color="border-green-500"  gradient="bg-green-500" />
                        <StatCard title="Rejected" value={stats.rejected}     icon={UserX}     color="border-red-500"    gradient="bg-red-500" />
                        <StatCard title="Blocked"  value={stats.blocked}      icon={ShieldX}   color="border-gray-500"   gradient="bg-gray-500" />
                        <StatCard title="Clients"  value={stats.totalClients} icon={Users}     color="border-amber-500"  gradient="bg-amber-500" />
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-lg font-bold capitalize">{activeFilter} Records ({filteredData.length})</h3>
                            {activeFilter === 'approved' && (
                                <div className="relative group">
                                    <button className="flex items-center bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold">
                                        <Download size={14} className="mr-2" /> Export
                                    </button>
                                    <div className="absolute right-0 mt-1 w-40 bg-white shadow-xl border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                        <button onClick={() => exportApprovedWorkers('excel')} className="w-full text-left px-4 py-2 text-sm hover:bg-orange-50">Excel Format</button>
                                        <button onClick={() => exportApprovedWorkers('pdf')}   className="w-full text-left px-4 py-2 text-sm hover:bg-orange-50">PDF Format</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4">
                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin h-10 w-10 border-4 border-orange-600 border-t-transparent rounded-full mx-auto"></div>
                                </div>
                            ) : filteredData.length > 0 ? (
                                <>
                                    {/* Mobile cards */}
                                    <div className="lg:hidden space-y-3">
                                        {filteredData.map(user => (
                                            <MobileUserCard
                                                key={user._id}
                                                user={user}
                                                baseURL={baseURL}
                                                onViewDetails={setSelectedUser}
                                                onVerifyOpen={setUserToVerify}
                                                onStatusUpdate={handleStatusUpdate}
                                                onDelete={handleDelete}
                                            />
                                        ))}
                                    </div>

                                    {/* Desktop table */}
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="pb-3 text-left"><SortHeader label="Name" sortKey="name" /></th>
                                                    <th className="pb-3 text-left"><SortHeader label="ID" sortKey="karigarId" /></th>
                                                    <th className="pb-3 text-left">Contact</th>
                                                    <th className="pb-3 text-left">{activeFilter === 'clients' ? 'Email' : 'Score / Skills'}</th>
                                                    {activeFilter !== 'clients' && <th className="pb-3 text-left">Status</th>}
                                                    <th className="pb-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredData.map(user => (
                                                    <tr key={user._id} className="border-b hover:bg-orange-50/50 transition-colors">
                                                        <td className="py-4">
                                                            <div className="flex items-center">
                                                                <img
                                                                    src={user.photo ? (user.photo.startsWith('http') ? user.photo : baseURL + user.photo) : '/default-avatar.png'}
                                                                    className="w-10 h-10 rounded-full object-cover mr-3 border-2 border-orange-100"
                                                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                                                />
                                                                <div>
                                                                    <p className="font-bold text-gray-800">{user.name}</p>
                                                                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 font-mono text-xs">{user.karigarId}</td>
                                                        <td className="py-4 text-sm">{user.mobile}</td>
                                                        <td className="py-4">
                                                            {user.role === 'worker' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-black">SCORE: {user.points || 0}</span>
                                                                    <span className="text-xs text-gray-400">Exp: {user.experience}y</span>
                                                                </div>
                                                            ) : <span className="text-sm">{user.email}</span>}
                                                        </td>
                                                        {activeFilter !== 'clients' && <td className="py-4">{renderStatusBadge(user.verificationStatus)}</td>}
                                                        <td className="py-4">
                                                            <div className="flex justify-end space-x-2">
                                                                <button onClick={() => setSelectedUser(user)} className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Eye size={16} /></button>
                                                                {user.role === 'worker' && user.verificationStatus === 'pending' && (
                                                                    <>
                                                                        <button onClick={() => setUserToVerify(user)} className="p-2 bg-green-100 text-green-600 rounded-lg" title="Verify & Assign Points"><Check size={16} /></button>
                                                                        <button onClick={() => {
                                                                            const reason = window.prompt('Enter rejection reason for worker application:') || '';
                                                                            handleStatusUpdate(user._id, 'rejected', 0, reason);
                                                                        }} className="p-2 bg-red-100 text-red-600 rounded-lg"><X size={16} /></button>
                                                                    </>
                                                                )}
                                                                {user.role === 'worker' && user.verificationStatus === 'approved' && (
                                                                    <button onClick={() => handleStatusUpdate(user._id, 'blocked')} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><ShieldX size={16} /></button>
                                                                )}
                                                                {user.role === 'worker' && user.verificationStatus === 'blocked' && (
                                                                    <button onClick={() => handleStatusUpdate(user._id, 'unblocked')} className="p-2 bg-green-100 text-green-600 rounded-lg"><ShieldCheck size={16} /></button>
                                                                )}
                                                                <button onClick={() => handleDelete(user._id, user.name, user.role)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 text-gray-400">No records found.</div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;