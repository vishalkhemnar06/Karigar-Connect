// src/pages/admin/AdminDashboard.jsx — UPDATED
// Changes from previous version:
//   - Sidebar extracted to src/components/admin/AdminSidebar.jsx
//   - Desktop sidebar is sticky + scrollable
//   - Mobile: slide-in drawer + bottom navigation bar (all nav at bottom)
//   - isSidebarOpen state still controls mobile drawer
//   - All original functionality preserved exactly

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import Header from '../../components/Header';
import {
    Check, X, ShieldX, Trash2, Eye, Users, UserCheck,
    UserX, Clock, ShieldCheck, Search, Download,
    ChevronDown, ChevronUp, Home, Mail, Phone,
    FileText, Image, Briefcase, AlertCircle,
    LogOut, Menu, X as CloseIcon, Calendar, Smartphone,
    MapPin as MapPinIcon, FileText as FileTextIcon,
    Camera, Award as AwardIcon, Star, PhoneCall, Store, Gift, Wrench, TrendingUp, BarChart3, RefreshCw
} from 'lucide-react';
import {
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

import AdminSidebar from '../../pages/admin/AdminSidebar';
import FraudMonitor from '../../pages/admin/FraudMonitor';
import AdminComplaints from '../../pages/admin/AdminComplaints';
import AdminWorkerComplaints from '../../pages/admin/AdminWorkerComplaints';
import AdminCommunity from '../../pages/admin/AdminCommunity';
import AdminShops from '../../pages/admin/AdminShops';
import AdminUsersSection from '../../pages/admin/AdminUsersSection';
import AdminMarketplaceSection from '../../pages/admin/AdminMarketplaceSection';
import AdminWorkerLeaderboardSection from '../../pages/admin/AdminWorkerLeaderboardSection';

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Verify Worker & Assign Points
// ─────────────────────────────────────────────────────────────────────────────
const VerificationModal = ({ worker, onClose, onConfirm }) => {
    const [points,   setPoints]   = useState(10);
    const [feedback, setFeedback] = useState('');

    if (!worker) return null;

    const experience = worker.experience || 0;
    const finalScore = Number(points) + (experience * 10);

    const handleSubmit = () => {
        if (points < 1 || points > 50) { return; }
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
                    <button onClick={onClose} className="hover:rotate-90 transition-transform"><CloseIcon size={24} /></button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Star size={16} className="text-orange-500" /> Assign Base Points (1 – 50)
                        </label>
                        <input
                            type="number" min="1" max="50"
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
                            <div className="flex justify-between"><span>Admin Points:</span><span className="font-mono">+{points || 0}</span></div>
                            <div className="flex justify-between"><span>Experience Bonus ({experience} yrs):</span><span className="font-mono">+{experience * 10}</span></div>
                            <div className="border-t border-orange-200 mt-2 pt-2 flex justify-between font-black text-lg text-orange-900">
                                <span>Final Ranking Score:</span><span>{finalScore}</span>
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

// ─────────────────────────────────────────────────────────────────────────────
// Modal: View User Details
// ─────────────────────────────────────────────────────────────────────────────
const UserDetailsModal = ({ user, onClose, baseURL }) => {
    if (!user) return null;

    const address   = user.address           || {};
    const emergency = user.emergencyContact  || {};
    const idDoc     = user.idProof           || {};

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
            <a href={resolvePath(path)} target="_blank" rel="noopener noreferrer"
                className="flex items-center text-orange-600 hover:text-orange-800 text-sm p-2 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors">
                {Icon && <Icon size={16} className="mr-2" />}{label}
            </a>
        ) : <span className="text-gray-400 text-sm">Not Provided</span>
    );

    const renderSkills = (skills) => {
        if (!skills || !Array.isArray(skills)) return 'N/A';
        return skills.map(s => typeof s === 'object' ? `${s.name} (${s.proficiency})` : s).join(', ');
    };

    return (
        <div className="fixed inset-0 z-[100] bg-orange-50/85 backdrop-blur-[2px] p-2 sm:p-4 lg:p-6" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 w-full max-w-6xl h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] mx-auto flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 p-4 sm:p-6 rounded-t-xl flex justify-between items-center z-10">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <img
                            src={getImageUrl(user.photo)}
                            alt={user.name}
                            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-4 border-white/20 shadow-lg"
                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                        />
                        <div className="text-white">
                            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold">{user.name}</h3>
                            <p className="text-orange-100 text-sm">{user.userId || user.karigarId} | {user.role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white text-2xl sm:text-3xl hover:text-orange-200 transition-colors leading-none">&times;</button>
                </div>

                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
                    {/* Personal & Contact */}
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 sm:p-5 rounded-xl border border-orange-100">
                        <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-orange-800 flex items-center">
                            <UserCheck size={18} className="mr-2" /> Personal & Contact Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <DetailItem label="Full Name"      value={user.name}                                                   icon={UserCheck} />
                            <DetailItem label="Age"            value={user.age || 'N/A'} />
                            <DetailItem label="Date of Birth"  value={user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A'} icon={Calendar}  />
                            <DetailItem label="Phone Type"     value={user.phoneType || 'N/A'}                                     icon={Smartphone} />
                            <DetailItem label="Gender"         value={user.gender} />
                            <DetailItem label="Mobile"         value={user.mobile}                                                 icon={Phone} />
                            <DetailItem label="Email"          value={user.email}                                                  icon={Mail} />
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
                            <DetailItem label="Full Address"   value={address.fullAddress || user.fullAddress || address.homeLocation || user.homeLocation} icon={MapPinIcon} />
                            <DetailItem label="City"           value={address.city     || user.city}     icon={Home} />
                            <DetailItem label="Village"        value={address.village  || user.village} />
                            <DetailItem label="Pincode"        value={address.pincode  || user.pincode} />
                            <DetailItem label="Locality/Area"  value={address.locality || user.locality} />
                            <DetailItem label="House Number"   value={address.houseNumber || user.houseNumber} />
                            <DetailItem label="Latitude"       value={address.latitude ?? user.latitude} />
                            <DetailItem label="Longitude"      value={address.longitude ?? user.longitude} />
                        </div>
                    </div>

                    {/* Worker-specific */}
                    {user.role === 'worker' && (
                        <>
                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 sm:p-5 rounded-xl border border-yellow-100">
                                <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-amber-800 flex items-center">
                                    <Briefcase size={18} className="mr-2" /> Professional Details
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <DetailItem label="Overall Experience"   value={user.overallExperience} />
                                    <DetailItem label="Years of Experience"  value={user.experience ? `${user.experience} years` : 'N/A'} />
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
                                            {user.references?.length > 0
                                                ? user.references.map((ref, i) => (
                                                    <div key={i} className="bg-white p-2 sm:p-3 rounded-lg border border-orange-100">
                                                        <p className="text-sm font-medium">{ref.name}</p>
                                                        <p className="text-xs text-gray-600">{ref.contact}</p>
                                                    </div>
                                                ))
                                                : <p className="text-sm text-gray-500">No references provided</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Client-specific */}
                    {user.role === 'client' && (
                        <>
                            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 sm:p-5 rounded-xl border border-red-100">
                                <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-red-800 flex items-center">
                                    <AlertCircle size={18} className="mr-2" /> Security & Verification
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <DetailItem label="Age Verified (18+)" value={user.ageVerified ? '✓ Yes' : '✗ No'} />
                                    <DetailItem label="Address Verified" value={user.addressVerified ? '✓ Yes' : '✗ No'} />
                                    <DetailItem label="Emergency Contact Name" value={emergency.name || 'N/A'} />
                                    <DetailItem label="Emergency Contact Mobile" value={emergency.mobile || 'N/A'} />
                                    <DetailItem label="Device Fingerprint" value={user.deviceFingerprint ? user.deviceFingerprint.substring(0, 16) + '...' : 'N/A'} />
                                    <DetailItem label="Signup IP Address" value={user.signupIpAddress || 'N/A'} />
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-blue-50 to-orange-50 p-4 sm:p-5 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-blue-800 flex items-center">
                                    <Briefcase size={18} className="mr-2" /> Profile & Intent
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <DetailItem label="Profession/Occupation" value={user.profession || user.workplaceInfo || 'N/A'} />
                                    <DetailItem label="Signup Reason" value={user.signupReason || 'N/A'} />
                                    <DetailItem label="Previous Hiring Experience" value={user.previousHiringExperience === true ? 'Yes' : user.previousHiringExperience === false ? 'No' : 'N/A'} />
                                    <DetailItem label="Preferred Payment Method" value={user.preferredPaymentMethod || 'N/A'} />
                                    <DetailItem label="Business Registration #" value={user.businessRegistrationNumber || 'N/A'} />
                                    <DetailItem label="GST/Tax ID" value={user.gstTaxId || 'N/A'} />
                                    <DetailItem label="Insurance Details" value={user.insuranceDetails || 'N/A'} />
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-green-50 to-orange-50 p-4 sm:p-5 rounded-xl border border-green-100">
                                <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-green-800 flex items-center">
                                    <FileTextIcon size={18} className="mr-2" /> Terms & Conditions Acceptance
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <DetailItem label="Payment T&C" value={user.termsPaymentAccepted ? '✓ Accepted' : '✗ Not Accepted'} />
                                    <DetailItem label="Dispute Policy" value={user.termsDisputePolicyAccepted ? '✓ Accepted' : '✗ Not Accepted'} />
                                    <DetailItem label="Data Privacy" value={user.termsDataPrivacyAccepted ? '✓ Accepted' : '✗ Not Accepted'} />
                                    <DetailItem label="Worker Protection" value={user.termsWorkerProtectionAccepted ? '✓ Accepted' : '✗ Not Accepted'} />
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 sm:p-5 rounded-xl border border-orange-100">
                                <h4 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-orange-800 flex items-center">
                                    <Briefcase size={18} className="mr-2" /> Additional Information
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <DetailItem label="Workplace/Profession (Legacy)" value={user.workplaceInfo || 'N/A'} />
                                    <DetailItem label="Social Profile"
                                        value={user.socialProfile
                                            ? <a href={user.socialProfile} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">View Profile</a>
                                            : 'N/A'}
                                    />
                                </div>
                            </div>
                        </>
                    )}

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
                            {user.role === 'client' && (
                                <>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Proof of Residence</p>
                                        <FileLink path={user.proofOfResidence} label="View Proof" icon={FileText} />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Secondary ID Proof</p>
                                        <FileLink path={user.secondaryIdProof} label="View Secondary ID" icon={FileText} />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Professional Certification</p>
                                        <FileLink path={user.professionalCertification} label="View Certification" icon={AwardIcon} />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Live Face Photo</p>
                                        <FileLink path={user.liveFacePhoto} label="View Live Face" icon={Camera} />
                                        <p className="text-xs text-gray-600 mt-1">
                                            Similarity: {typeof user.faceVerificationScore === 'number' ? user.faceVerificationScore.toFixed(3) : 'N/A'} | Status: {user.faceVerificationStatus || 'N/A'}
                                        </p>
                                    </div>
                                </>
                            )}
                            {user.role === 'worker' && (
                                <>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">E-Shram Card</p>
                                        <FileLink path={user.eShramCardPath || user.eShramCard} label="View E-Shram Card" icon={FileText} />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Live Face Photo</p>
                                        <FileLink path={user.liveFacePhoto} label="View Live Face" icon={Camera} />
                                        <p className="text-xs text-gray-600 mt-1">
                                            Similarity: {typeof user.faceVerificationScore === 'number' ? user.faceVerificationScore.toFixed(3) : 'N/A'} | Status: {user.faceVerificationStatus || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="sm:col-span-2 space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Skill Certificates</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {user.skillCertificates?.length > 0
                                                ? user.skillCertificates.map((cert, i) => <FileLink key={i} path={cert} label={`Certificate ${i + 1}`} icon={AwardIcon} />)
                                                : <span className="text-gray-400 text-sm">Not Provided</span>}
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2 space-y-2">
                                        <p className="font-semibold text-orange-600 text-xs uppercase">Portfolio Photos</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {user.portfolioPhotos?.length > 0
                                                ? user.portfolioPhotos.map((photo, i) => <FileLink key={i} path={photo} label={`Photo ${i + 1}`} icon={Image} />)
                                                : <span className="text-gray-400 text-sm">Not Provided</span>}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-orange-50 p-3 sm:p-4 border-t border-orange-100 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-4 sm:px-6 py-2 bg-orange-200 text-orange-800 rounded-lg hover:bg-orange-300 transition-colors font-medium text-sm sm:text-base">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};



// ─────────────────────────────────────────────────────────────────────────────
// Mobile User Card
// ─────────────────────────────────────────────────────────────────────────────
const MobileUserCard = ({ user, currentAdminId, onViewDetails, onVerifyOpen, onClaimWorker, onStatusUpdate, onDelete }) => {
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
        const names = skills.map(s => typeof s === 'object' ? s.name : s);
        return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-orange-100 p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                    <img
                        src={getImageUrl(user.photo)}
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
                <div className="flex space-x-1 ml-auto">
                    <button onClick={() => onViewDetails(user)} className="p-1.5 bg-orange-100 text-orange-600 rounded hover:bg-orange-200"><Eye size={14} /></button>
                    {(() => {
                        const lockOwnerId = user?.reviewLock?.lockedBy?._id || user?.reviewLock?.lockedBy || null;
                        const claimedByMe = lockOwnerId && String(lockOwnerId) === String(currentAdminId);
                        const claimedByOther = lockOwnerId && !claimedByMe;

                        if (user.role === 'worker' && user.verificationStatus === 'pending') {
                            if (!lockOwnerId) {
                                return <button onClick={() => onClaimWorker(user._id)} className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Claim"><ShieldCheck size={14} /></button>;
                            }
                            if (claimedByMe) {
                                return (
                                    <>
                                        <button onClick={() => onVerifyOpen(user)} className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"><Check size={14} /></button>
                                        <button onClick={() => {
                                            const reason = window.prompt('Enter rejection reason for worker application:') || '';
                                            onStatusUpdate(user._id, 'rejected', 0, reason);
                                        }} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><X size={14} /></button>
                                    </>
                                );
                            }
                            if (claimedByOther) {
                                return <span className="px-2 py-1 text-[10px] rounded bg-gray-100 text-gray-600">Locked</span>;
                            }
                        }
                        return null;
                    })()}
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const location = useLocation();
    const navState = location.state || {};

    const [workers,        setWorkers]        = useState([]);
    const [clients,        setClients]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [selectedUser,   setSelectedUser]   = useState(null);
    const [userToVerify,   setUserToVerify]   = useState(null);
    const [activeFilter,   setActiveFilter]   = useState(navState.activeFilter || 'pending');
    const [searchTerm,     setSearchTerm]     = useState('');
    const [workerReviewTab, setWorkerReviewTab] = useState(
        ['pending', 'approved', 'rejected', 'blocked'].includes(navState.activeFilter) ? navState.activeFilter : 'pending'
    );
    const [workerSearchByTab, setWorkerSearchByTab] = useState({
        pending: '',
        approved: '',
        rejected: '',
        blocked: '',
    });
    const [workerCityByTab, setWorkerCityByTab] = useState({
        pending: 'all',
        approved: 'all',
        rejected: 'all',
        blocked: 'all',
    });
    const [sortConfig,     setSortConfig]     = useState({ key: null, direction: 'asc' });
    const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);
    const [isLoggedIn,     setIsLoggedIn]     = useState(true);
    const [currentSection, setCurrentSection] = useState(navState.currentSection || 'dashboard'); // 'dashboard', 'fraud', 'complaints', 'worker-complaints', 'community', 'shops', 'users', 'marketplace', 'leaderboard'
    const [viewMode, setViewMode] = useState(navState.viewMode || 'stats'); // 'stats' or 'records'
    const [directHirePayments, setDirectHirePayments] = useState([]);
    const [directHireLoading, setDirectHireLoading] = useState(false);
    const [directHireTab, setDirectHireTab] = useState('pending');
    const [directHireCityFilter, setDirectHireCityFilter] = useState('all');
    const [directHireSkillFilter, setDirectHireSkillFilter] = useState('all');
    const [directHireSearch, setDirectHireSearch] = useState('');
    const [directHireCityOptions, setDirectHireCityOptions] = useState([]);
    const [directHireSkillOptions, setDirectHireSkillOptions] = useState([]);
    const [directHireSummary, setDirectHireSummary] = useState({ totalPaidAmount: 0, count: 0 });
    const [directHireActionLoading, setDirectHireActionLoading] = useState({});
    const [dashboardStats, setDashboardStats] = useState({
        ivrStats: {},
        shops: 0,
        couponsGenerated: 0,
        topSkills: []
    });

    const navigate = useNavigate();
    // const baseURL  = 'http://localhost:5000/';
    // const baseURL = 'http://Y192.168.0.103:5000/';
    const baseURL = `${window.location.protocol}//${window.location.hostname}:5000/`;

    const currentAdminId = useMemo(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user?.id ? String(user.id) : null;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            const handleBack = (e) => { e.preventDefault(); window.history.forward(); };
            window.history.pushState(null, null, window.location.pathname);
            window.addEventListener('popstate', handleBack);
            return () => window.removeEventListener('popstate', handleBack);
        }
    }, [isLoggedIn]);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [workersRes, clientsRes] = await Promise.all([api.getAllWorkers(), api.getAllClients()]);
            setWorkers(workersRes.data);
            setClients(clientsRes.data);
        } catch {
            // silently fail when silent mode enabled
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchDashboardStats = async () => {
        try {
            const statsRes = await api.getAdminStats();
            setDashboardStats(statsRes.data);
        } catch (err) {
            console.error('Error fetching dashboard stats:', err);
        }
    };

    const fetchDirectHirePayments = async () => {
        try {
            setDirectHireLoading(true);
            const response = await api.getAdminDirectHirePayments({
                tab: directHireTab,
                city: directHireCityFilter,
                skill: directHireSkillFilter,
                search: directHireSearch,
            });
            const rows = Array.isArray(response?.data?.jobs) ? response.data.jobs : [];
            setDirectHirePayments(rows);
            setDirectHireCityOptions(Array.isArray(response?.data?.filters?.cities) ? response.data.filters.cities : []);
            setDirectHireSkillOptions(Array.isArray(response?.data?.filters?.skills) ? response.data.filters.skills : []);
            setDirectHireSummary(response?.data?.summary || { totalPaidAmount: 0, count: rows.length });
        } catch (err) {
            console.error('Error fetching direct hire payments:', err);
        } finally {
            setDirectHireLoading(false);
        }
    };

    useEffect(() => { 
        fetchData();
        fetchDashboardStats();
    }, []);

    useEffect(() => {
        if (currentSection === 'direct-hires') {
            fetchDirectHirePayments();
        }
    }, [currentSection, directHireTab, directHireCityFilter, directHireSkillFilter, directHireSearch]);

    const formatMoney = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

    const formatJobDateTime = (job) => {
        const sourceDate = job?.directHire?.expectedStartAt || job?.scheduledDate;
        if (!sourceDate) return 'Not scheduled';
        const date = new Date(sourceDate);
        const dateText = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeText = job?.scheduledTime || date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return `${dateText} • ${timeText}`;
    };

    const handleWarnClient = async (jobId) => {
        try {
            setDirectHireActionLoading((prev) => ({ ...prev, [`warn-${jobId}`]: true }));
            await api.adminWarnDirectHireClient(jobId);
            await fetchDirectHirePayments();
        } catch (err) {
            console.error('Warning failed:', err);
        } finally {
            setDirectHireActionLoading((prev) => ({ ...prev, [`warn-${jobId}`]: false }));
        }
    };

    const handleBlockClient = async (jobId) => {
        try {
            setDirectHireActionLoading((prev) => ({ ...prev, [`block-${jobId}`]: true }));
            await api.adminBlockDirectHireClient(jobId);
            await fetchDirectHirePayments();
        } catch (err) {
            console.error('Block failed:', err);
        } finally {
            setDirectHireActionLoading((prev) => ({ ...prev, [`block-${jobId}`]: false }));
        }
    };

    const handleUnblockClient = async (jobId) => {
        try {
            setDirectHireActionLoading((prev) => ({ ...prev, [`unblock-${jobId}`]: true }));
            await api.adminUnblockDirectHireClient(jobId);
            await fetchDirectHirePayments();
        } catch (err) {
            console.error('Unblock failed:', err);
        } finally {
            setDirectHireActionLoading((prev) => ({ ...prev, [`unblock-${jobId}`]: false }));
        }
    };

    useEffect(() => {
        if (navState.activeFilter) setActiveFilter(navState.activeFilter);
        if (navState.currentSection) setCurrentSection(navState.currentSection);
        if (navState.viewMode) setViewMode(navState.viewMode);
    }, [navState.activeFilter, navState.currentSection, navState.viewMode]);

    useEffect(() => {
        if (['pending', 'approved', 'rejected', 'blocked'].includes(navState.activeFilter)) {
            setWorkerReviewTab(navState.activeFilter);
        }
    }, [navState.activeFilter]);

    useEffect(() => {
        if (activeFilter === 'pending') {
            setWorkerReviewTab('pending');
        }
    }, [activeFilter]);

    useEffect(() => {
        if (activeFilter !== 'pending') return;
        const intervalId = setInterval(() => fetchData(true), 15000);
        return () => clearInterval(intervalId);
    }, [activeFilter]);

    const handleLogout = () => {
        setIsLoggedIn(false);
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
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
            data = data.filter(u =>
                u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.mobile?.includes(searchTerm) ||
                u.karigarId?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (sortConfig.key) {
            data.sort((a, b) => {
                const av = a[sortConfig.key], bv = b[sortConfig.key];
                if (av < bv) return sortConfig.direction === 'asc' ? -1 :  1;
                if (av > bv) return sortConfig.direction === 'asc' ?  1 : -1;
                return 0;
            });
        }
        return data;
    }, [activeFilter, workers, clients, searchTerm, sortConfig]);

    const workerCityOptions = useMemo(() => {
        const tabWorkers = workers.filter((worker) => worker.verificationStatus === workerReviewTab);
        const cities = Array.from(new Set(
            tabWorkers
                .map((worker) => String(worker?.address?.city || worker?.city || '').trim())
                .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b));

        return cities;
    }, [workers, workerReviewTab]);

    const workerReviewRows = useMemo(() => {
        const query = String(workerSearchByTab[workerReviewTab] || '').trim().toLowerCase();
        const cityFilter = String(workerCityByTab[workerReviewTab] || 'all').trim().toLowerCase();
        let data = workers.filter((worker) => worker.verificationStatus === workerReviewTab);

        if (cityFilter !== 'all') {
            data = data.filter((worker) => String(worker?.address?.city || worker?.city || '').trim().toLowerCase() === cityFilter);
        }

        if (query) {
            data = data.filter((worker) => [
                worker?.name,
                worker?.mobile,
                worker?.karigarId,
            ].some((value) => String(value || '').toLowerCase().includes(query)));
        }

        return data;
    }, [workers, workerReviewTab, workerSearchByTab, workerCityByTab]);

    const currentWorkerSearch = workerSearchByTab[workerReviewTab] || '';
    const setCurrentWorkerSearch = (value) => {
        setWorkerSearchByTab((prev) => ({ ...prev, [workerReviewTab]: value }));
    };
    const currentWorkerCity = workerCityByTab[workerReviewTab] || 'all';
    const setCurrentWorkerCity = (value) => {
        setWorkerCityByTab((prev) => ({ ...prev, [workerReviewTab]: value }));
    };

    const handleSort = (key) => setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));

    const handleStatusUpdate = async (workerId, status, points = 0, feedback = '') => {
        try {
            await api.updateWorkerStatus({ workerId, status, points: Number(points), rejectionReason: feedback });
            setUserToVerify(null);
            fetchData(true);
        } catch {
            // silently handle errors
        }
    };

    const handleClaimWorker = async (workerId) => {
        try {
            await api.claimWorkerForReview(workerId);
            fetchData(true);
        } catch {
            // silently handle errors
        }
    };

    const handleDelete = async (userId, name, role) => {
        if (!window.confirm(`Delete ${role}: ${name}?`)) return;
        try {
            await api.deleteUser(userId);
            fetchData();
        } catch {
            // silently handle errors
        }
    };

    const exportApprovedWorkers = (format) => {
        const approved = workers.filter(w => w.verificationStatus === 'approved');
        if (!approved.length) { return; }
        if (format === 'excel') {
            const rows = approved.map(w => ({
                'Karigar ID': w.karigarId, Name: w.name, Mobile: w.mobile,
                Score: w.points || 0, Experience: w.experience, City: w.city,
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Approved');
            XLSX.writeFile(wb, 'workers.xlsx');
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.text('Approved Workers', 14, 22);
            doc.autoTable({
                startY: 30,
                head:   [['ID', 'Name', 'Mobile', 'Score', 'City']],
                body:   approved.map(w => [w.karigarId, w.name, w.mobile, w.points || 0, w.city]),
            });
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

    const StatCard = ({ title, value, icon: Icon, color, gradient }) => {
        if (!Icon) return null;  // Ensure Icon is used
        return (
            <div className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${color} relative overflow-hidden group hover:shadow-md transition-shadow`}>
                <div className={`absolute top-0 right-0 w-16 h-16 opacity-10 ${gradient} rounded-full -m-4 group-hover:scale-110 transition-transform`}></div>
                <div className="relative z-10">
                    <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
                    <p className="text-xl lg:text-3xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`absolute bottom-4 right-4 p-2 rounded-lg ${gradient} text-white`}><Icon size={18} /></div>
            </div>
        );
    };

    const WorkerReviewBoard = ({
        currentTab,
        onTabChange,
        searchValue,
        onSearchChange,
        cityValue,
        onCityChange,
        cityOptions,
        rows,
        stats,
        onRefresh,
        currentAdminId,
        onViewDetails,
        onClaimWorker,
        onStatusUpdate,
        onDelete,
        onVerifyOpen,
    }) => {
        const tabs = [
            { key: 'pending', label: 'Pending', count: stats.pending, icon: Clock, tone: 'amber' },
            { key: 'approved', label: 'Approved', count: stats.approved, icon: UserCheck, tone: 'green' },
            { key: 'rejected', label: 'Rejected', count: stats.rejected, icon: UserX, tone: 'red' },
            { key: 'blocked', label: 'Blocked', count: stats.blocked, icon: ShieldX, tone: 'slate' },
        ];

        const tabTone = {
            amber: 'from-amber-400 to-orange-500',
            green: 'from-emerald-500 to-green-600',
            red: 'from-rose-500 to-red-600',
            slate: 'from-slate-600 to-slate-700',
        };

        const chipTone = {
            pending: 'bg-amber-100 text-amber-800 border-amber-200',
            approved: 'bg-green-100 text-green-800 border-green-200',
            rejected: 'bg-red-100 text-red-800 border-red-200',
            blocked: 'bg-slate-100 text-slate-800 border-slate-200',
        };

        const renderCard = (user) => {
            const lockOwnerId = user?.reviewLock?.lockedBy?._id || user?.reviewLock?.lockedBy || null;
            const claimedByMe = lockOwnerId && String(lockOwnerId) === String(currentAdminId);
            const claimedByOther = lockOwnerId && !claimedByMe;
            const city = user?.address?.city || user?.city || 'N/A';

            return (
                <div key={user._id} className="group rounded-3xl border border-orange-100 bg-white shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300">
                    <div className={`h-20 bg-gradient-to-r ${
                        user.verificationStatus === 'approved' ? 'from-emerald-400 to-green-500' :
                        user.verificationStatus === 'rejected' ? 'from-rose-400 to-red-500' :
                        user.verificationStatus === 'blocked' ? 'from-slate-500 to-slate-700' :
                        'from-amber-400 to-orange-500'
                    }`} />

                    <div className="px-5 pb-5 -mt-10">
                        <div className="flex items-start gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <img
                                    src={getImageUrl(user.photo)}
                                    alt={user.name}
                                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg bg-white"
                                    onError={(event) => { event.currentTarget.src = '/default-avatar.png'; }}
                                />
                                <div className="pt-1 min-w-0 flex-1">
                                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-500">Worker</p>
                                    <h3 className="text-lg font-black text-gray-900 leading-tight break-words whitespace-normal">{user.name}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{city}</p>
                                </div>
                            </div>
                            <span className={`shrink-0 px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-[0.18em] ${chipTone[user.verificationStatus] || chipTone.pending}`}>
                                {user.verificationStatus}
                            </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <InfoPill label="Mobile" value={user.mobile || 'N/A'} />
                            <InfoPill label="Karigar ID" value={user.karigarId || 'N/A'} mono />
                            <InfoPill label="Points" value={user.points || 0} />
                            <InfoPill label="Experience" value={`${user.experience || 0} yrs`} />
                        </div>

                        {user.role === 'worker' && user.verificationStatus === 'pending' && user?.reviewLock?.lockedBy && (
                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                Locked by {user.reviewLock.lockedBy.name || 'Admin'}
                            </div>
                        )}

                        <div className="mt-4 grid grid-cols-1 gap-2">
                            <button
                                type="button"
                                onClick={() => onViewDetails(user)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:shadow-md transition-shadow"
                            >
                                <Eye size={16} /> View Details
                            </button>

                            {user.role === 'worker' && user.verificationStatus === 'pending' && (
                                !lockOwnerId ? (
                                    <button
                                        type="button"
                                        onClick={() => onClaimWorker(user._id)}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                                    >
                                        <ShieldCheck size={16} /> Claim Review
                                    </button>
                                ) : claimedByMe ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onVerifyOpen(user)}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
                                        >
                                            <Check size={16} /> Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const reason = window.prompt('Enter rejection reason:') || '';
                                                onStatusUpdate(user._id, 'rejected', 0, reason);
                                            }}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-500 transition-colors"
                                        >
                                            <X size={16} /> Reject
                                        </button>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-sm font-bold text-slate-600">
                                        Under Review
                                    </div>
                                )
                            )}

                            {user.role === 'worker' && user.verificationStatus === 'approved' && (
                                <button
                                    type="button"
                                    onClick={() => onStatusUpdate(user._id, 'blocked')}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                    <ShieldX size={16} /> Block Account
                                </button>
                            )}

                            {user.role === 'worker' && user.verificationStatus === 'blocked' && (
                                <button
                                    type="button"
                                    onClick={() => onStatusUpdate(user._id, 'unblocked')}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                                >
                                    <ShieldCheck size={16} /> Unblock Account
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => onDelete(user._id, user.name, user.role)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition-colors"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="bg-white rounded-3xl border border-orange-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-orange-100 bg-gradient-to-r from-orange-50 via-white to-white space-y-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Workers</p>
                            <h3 className="text-2xl font-black text-gray-900">Pending Review Board</h3>
                            <p className="text-sm text-gray-500">Switch between worker statuses. Search only matches the active tab by name or mobile.</p>
                        </div>
                        <div className="flex items-center gap-2 w-full lg:w-auto">
                            <button
                                type="button"
                                onClick={onRefresh}
                                className="inline-flex items-center justify-center rounded-2xl border border-orange-200 bg-white p-3 text-orange-600 hover:bg-orange-50 hover:border-orange-300 transition-colors"
                                title="Refresh Pending Review"
                                aria-label="Refresh Pending Review"
                            >
                                <RefreshCw size={16} />
                            </button>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 lg:flex-none">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const active = currentTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => onTabChange(tab.key)}
                                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${active ? `bg-gradient-to-r ${tabTone[tab.tone]} text-white border-transparent shadow-lg shadow-orange-100` : 'bg-white border-gray-200 text-gray-700 hover:border-orange-200 hover:bg-orange-50'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <Icon size={16} />
                                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'}`}>
                                                {tab.count}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm font-bold">{tab.label}</p>
                                    </button>
                                );
                            })}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                        <select
                            value={cityValue}
                            onChange={(event) => onCityChange(event.target.value)}
                            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 lg:min-w-[220px]"
                        >
                            <option value="all">All Cities</option>
                            {cityOptions.map((city) => (
                                <option key={city} value={city.toLowerCase()}>{city}</option>
                            ))}
                        </select>
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchValue}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder={`Search ${currentTab} workers by name or mobile`}
                                className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50"
                            />
                        </div>
                        {searchValue && (
                            <button
                                type="button"
                                onClick={() => onSearchChange('')}
                                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-100 transition-colors"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    {rows.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {rows.map((worker) => renderCard(worker))}
                        </div>
                    ) : (
                        <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50/50 p-10 text-center text-gray-500">
                            <p className="text-lg font-bold text-gray-700">No {currentTab} workers found.</p>
                            <p className="mt-2 text-sm">Try a different search term or switch tabs.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const InfoPill = ({ label, value, mono = false }) => (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{label}</p>
            <p className={`mt-1 text-sm font-bold text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
        </div>
    );

    const SortHeader = ({ label, sortKey }) => (
        <button onClick={() => handleSort(sortKey)} className="flex items-center font-semibold text-gray-700 hover:text-orange-700 text-sm">
            {label}
            {sortConfig.key === sortKey && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </button>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
            {/* Modals */}
            <VerificationModal worker={userToVerify} onClose={() => setUserToVerify(null)} onConfirm={handleStatusUpdate} />
            <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} baseURL={baseURL} />

            {/* Header */}
            <Header />

            {/* Body: sidebar + main */}
            <div className="flex">
                {/* ── Sidebar (desktop sticky / mobile drawer + bottom nav) ── */}
                <AdminSidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                    currentSection={currentSection}
                    onSectionChange={setCurrentSection}
                    stats={stats}
                    dashboardStats={dashboardStats}
                    onViewModeChange={setViewMode}
                />

                {/* ── Main content ── */}
                {/* pb-20 on mobile to clear the bottom nav bar */}
                <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 min-w-0 overflow-auto">
                    {currentSection === 'dashboard' && viewMode === 'stats' && (
                        <>
                            {/* Dashboard Section - Stats Only */}
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">📊 Dashboard</h1>
                                    <p className="text-gray-500 text-sm">Overview of platform metrics and statistics</p>
                                </div>
                            </div>

                            {/* IVR & Call Center Metrics */}
                            <div className="mb-8">
                                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <PhoneCall size={20} className="text-blue-500" />
                                    IVR & Call Center Metrics
                                </h2>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                    <StatCard title="Total Calls" value={dashboardStats.ivrStats?.totalCalls || 0} icon={PhoneCall} color="border-blue-500" gradient="bg-blue-500" />
                                    <StatCard title="Daily Calls" value={dashboardStats.ivrStats?.dailyCalls || 0} icon={TrendingUp} color="border-cyan-500" gradient="bg-cyan-500" />
                                    <StatCard title="Weekly Calls" value={dashboardStats.ivrStats?.weeklyCalls || 0} icon={BarChart3} color="border-indigo-500" gradient="bg-indigo-500" />
                                    <StatCard title="Monthly Calls" value={dashboardStats.ivrStats?.monthlyCalls || 0} icon={Calendar} color="border-purple-500" gradient="bg-purple-500" />
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl shadow-sm border border-green-100 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 opacity-10 bg-green-500 rounded-full -m-4 group-hover:scale-110 transition-transform"></div>
                                        <div className="relative z-10">
                                            <p className="text-xs font-medium text-gray-500 mb-1">Avg Call Duration</p>
                                            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{dashboardStats.ivrStats?.avgCallDurationSeconds || 0}s</p>
                                            <p className="text-xs text-gray-400 mt-1">seconds per call</p>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-5 rounded-xl shadow-sm border border-rose-100 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 opacity-10 bg-rose-500 rounded-full -m-4 group-hover:scale-110 transition-transform"></div>
                                        <div className="relative z-10">
                                            <p className="text-xs font-medium text-gray-500 mb-1">Total Shops</p>
                                            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{dashboardStats.shops || 0}</p>
                                            <p className="text-xs text-gray-400 mt-1">registered partners</p>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-5 rounded-xl shadow-sm border border-amber-100 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 opacity-10 bg-amber-500 rounded-full -m-4 group-hover:scale-110 transition-transform"></div>
                                        <div className="relative z-10">
                                            <p className="text-xs font-medium text-gray-500 mb-1">Coupons Generated</p>
                                            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{dashboardStats.couponsGenerated || 0}</p>
                                            <p className="text-xs text-gray-400 mt-1">active promotions</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Most Popular Skills */}
                            {dashboardStats.topSkills && dashboardStats.topSkills.length > 0 && (
                                <div className="mb-8">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Wrench size={20} className="text-orange-500" />
                                        Most Posted Skills
                                    </h2>
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                        {dashboardStats.topSkills.map((skill, idx) => (
                                            <div key={idx} className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
                                                <div className="flex items-center justify-between mb-2">
                                                    <Wrench size={20} className="text-orange-500" />
                                                    <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">{skill.count}</span>
                                                </div>
                                                <p className="font-semibold text-gray-800 text-sm capitalize">{skill.skill}</p>
                                                <p className="text-xs text-gray-500 mt-1">jobs posted</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* User Statistics */}
                            <div className="mb-8">
                                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Users size={20} className="text-orange-500" />
                                    User Management Overview
                                </h2>
                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                                    <StatCard title="Total Workers" value={stats.totalWorkers} icon={Users} color="border-orange-500" gradient="bg-orange-500" />
                                    <StatCard title="Pending" value={stats.pending} icon={Clock} color="border-yellow-500" gradient="bg-yellow-500" />
                                    <StatCard title="Approved" value={stats.approved} icon={UserCheck} color="border-green-500" gradient="bg-green-500" />
                                    <StatCard title="Rejected" value={stats.rejected} icon={UserX} color="border-red-500" gradient="bg-red-500" />
                                    <StatCard title="Blocked" value={stats.blocked} icon={ShieldX} color="border-gray-500" gradient="bg-gray-500" />
                                    <StatCard title="Total Clients" value={stats.totalClients} icon={Users} color="border-amber-500" gradient="bg-amber-500" />
                                </div>
                            </div>

                            {/* Worker Status Distribution - Pie Chart */}
                            {dashboardStats.workerStatusBreakdown && (
                                <div className="mb-8">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <BarChart3 size={20} className="text-teal-500" />
                                        Worker Status Distribution
                                    </h2>
                                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Pending', value: dashboardStats.workerStatusBreakdown.pending, fill: '#eab308' },
                                                        { name: 'Approved', value: dashboardStats.workerStatusBreakdown.approved, fill: '#22c55e' },
                                                        { name: 'Rejected', value: dashboardStats.workerStatusBreakdown.rejected, fill: '#ef4444' },
                                                        { name: 'Blocked', value: dashboardStats.workerStatusBreakdown.blocked, fill: '#6b7280' }
                                                    ]}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={(entry) => `${entry.name}: ${entry.value}`}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    <Cell fill="#eab308" />
                                                    <Cell fill="#22c55e" />
                                                    <Cell fill="#ef4444" />
                                                    <Cell fill="#6b7280" />
                                                </Pie>
                                                <Tooltip formatter={(value) => value} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Job Status Distribution - Bar Chart */}
                            {dashboardStats.jobStatusBreakdown && (
                                <div className="mb-8">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Briefcase size={20} className="text-blue-500" />
                                        Job Status Distribution
                                    </h2>
                                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart
                                                data={[
                                                    { name: 'Open', count: dashboardStats.jobStatusBreakdown.open },
                                                    { name: 'Running', count: dashboardStats.jobStatusBreakdown.running },
                                                    { name: 'Completed', count: dashboardStats.jobStatusBreakdown.completed },
                                                    { name: 'Cancelled', count: dashboardStats.jobStatusBreakdown.cancelled }
                                                ]}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip />
                                                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* IVR Calls Trend - Line Chart */}
                            {dashboardStats.weeklyIVRTrend && dashboardStats.weeklyIVRTrend.length > 0 && (
                                <div className="mb-8">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <PhoneCall size={20} className="text-blue-600" />
                                        IVR Calls Trend (Last 4 Weeks)
                                    </h2>
                                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={dashboardStats.weeklyIVRTrend}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis 
                                                    dataKey="_id" 
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={80}
                                                />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="count" 
                                                    stroke="#3b82f6" 
                                                    dot={{ fill: '#3b82f6', r: 5 }}
                                                    activeDot={{ r: 7 }}
                                                    name="Calls"
                                                    isAnimationActive={true}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Daily Worker Registrations - Area Chart */}
                            {dashboardStats.dailyWorkerRegistrations && dashboardStats.dailyWorkerRegistrations.length > 0 && (
                                <div className="mb-8">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <TrendingUp size={20} className="text-green-500" />
                                        Daily Worker Registrations (Last 7 Days)
                                    </h2>
                                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <AreaChart data={dashboardStats.dailyWorkerRegistrations}>
                                                <defs>
                                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="_id" />
                                                <YAxis />
                                                <Tooltip />
                                                <Area 
                                                    type="monotone" 
                                                    dataKey="count" 
                                                    stroke="#10b981" 
                                                    fillOpacity={1} 
                                                    fill="url(#colorCount)"
                                                    name="Registrations"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {currentSection === 'dashboard' && viewMode === 'records' && (
                        <>
                            {/* Table */}
                            <div className="bg-white rounded-xl shadow-sm border">
                                <div className="p-6 border-b space-y-4">
                                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                        <h3 className="text-lg font-bold capitalize">
                                            {activeFilter === 'clients' ? `Client Records (${filteredData.length})` : 'Worker Review'}
                                        </h3>
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

                                    {activeFilter === 'clients' && (
                                        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                                            <div className="relative flex-1">
                                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search by name, mobile, or email..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm transition-all"
                                                />
                                            </div>
                                            {searchTerm && (
                                                <button
                                                    onClick={() => setSearchTerm('')}
                                                    className="px-3 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium text-sm transition-colors"
                                                >
                                                    Clear Search
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4">
                                    {loading ? (
                                        <div className="text-center py-12">
                                            <div className="animate-spin h-10 w-10 border-4 border-orange-600 border-t-transparent rounded-full mx-auto"></div>
                                        </div>
                                    ) : activeFilter !== 'clients' ? (
                                        <WorkerReviewBoard
                                            currentTab={workerReviewTab}
                                            onTabChange={setWorkerReviewTab}
                                            searchValue={currentWorkerSearch}
                                            onSearchChange={setCurrentWorkerSearch}
                                            cityValue={currentWorkerCity}
                                            onCityChange={setCurrentWorkerCity}
                                            cityOptions={workerCityOptions}
                                            rows={workerReviewRows}
                                            stats={stats}
                                            onRefresh={() => fetchData(true)}
                                            currentAdminId={currentAdminId}
                                            onViewDetails={setSelectedUser}
                                            onClaimWorker={handleClaimWorker}
                                            onStatusUpdate={handleStatusUpdate}
                                            onDelete={handleDelete}
                                            onVerifyOpen={setUserToVerify}
                                        />
                                    ) : filteredData.length > 0 ? (
                                            <>
                                            {/* Card Grid - Show on all devices */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                                {filteredData.map(user => {
                                                    const lockOwnerId = user?.reviewLock?.lockedBy?._id || user?.reviewLock?.lockedBy || null;
                                                    const claimedByMe = lockOwnerId && String(lockOwnerId) === String(currentAdminId);
                                                    const claimedByOther = lockOwnerId && !claimedByMe;

                                                    return (
                                                        <div key={user._id} className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                                                            {/* Enhanced Header Bar */}
                                                            <div className="h-16 bg-gradient-to-r from-orange-400 via-orange-300 to-amber-300"></div>

                                                            {/* Avatar */}
                                                            <div className="-mt-10 flex justify-center">
                                                                <img
                                                                    src={getImageUrl(user.photo)}
                                                                    alt={user.name}
                                                                    className="w-24 h-24 rounded-full border-4 border-white object-cover object-center shadow-lg"
                                                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                                                />
                                                            </div>

                                                            {/* Card Body - Enhanced */}
                                                            <div className="p-6 pt-2 space-y-4 relative">
                                                                {/* Status Badge - Top Right */}
                                                                {user.role === 'worker' && (
                                                                    <div className={`absolute top-6 right-6 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md ${
                                                                        user.verificationStatus === 'approved' ? 'bg-green-500' :
                                                                        user.verificationStatus === 'pending' ? 'bg-yellow-500' :
                                                                        user.verificationStatus === 'blocked' ? 'bg-red-500' :
                                                                        'bg-gray-500'
                                                                    }`}>
                                                                        {user.verificationStatus?.charAt(0).toUpperCase() + user.verificationStatus?.slice(1)}
                                                                    </div>
                                                                )}

                                                                {/* Name and Role */}
                                                                <div>
                                                                    <h3 className="font-bold text-lg text-gray-900 truncate">{user.name}</h3>
                                                                    <p className="text-sm text-gray-500 capitalize font-medium">{user.role}</p>
                                                                </div>

                                                                {/* Karigar ID */}
                                                                {user.karigarId && (
                                                                    <p className="text-xs text-gray-500 font-mono font-semibold bg-gray-100 p-2.5 rounded-lg border border-gray-300">{user.karigarId}</p>
                                                                )}

                                                                {/* Contact */}
                                                                <div className="flex items-center gap-2 text-sm text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-300">
                                                                    <Phone size={16} className="text-blue-600 flex-shrink-0" />
                                                                    <span className="font-mono font-medium">{user.mobile}</span>
                                                                </div>

                                                                {/* Score / Email */}
                                                                {user.role === 'worker' ? (
                                                                    <div className="flex gap-2">
                                                                        <div className="flex-1 bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg border border-orange-300 text-center">
                                                                            <p className="text-xs text-orange-700 font-bold tracking-wider">SCORE</p>
                                                                            <p className="text-2xl font-black text-orange-700">{user.points || 0}</p>
                                                                        </div>
                                                                        <div className="flex-1 bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-300 text-center">
                                                                            <p className="text-xs text-purple-700 font-bold tracking-wider">EXP</p>
                                                                            <p className="text-2xl font-black text-purple-700">{user.experience}y</p>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-gray-700 break-all bg-blue-50 p-3 rounded-lg border border-blue-300">
                                                                        <p className="font-bold text-blue-700 text-xs mb-1 tracking-wider">EMAIL</p>
                                                                        <p className="font-mono text-xs truncate">{user.email}</p>
                                                                    </div>
                                                                )}

                                                                {/* Lock Info */}
                                                                {user.verificationStatus === 'pending' && user?.reviewLock?.lockedBy && (
                                                                    <div className="text-xs bg-yellow-50 p-3 rounded-lg border border-yellow-300 flex items-center gap-2">
                                                                        <span className="text-lg">🔒</span>
                                                                        <span className="font-bold text-yellow-800 truncate">Locked by {user.reviewLock.lockedBy.name || 'Admin'}</span>
                                                                    </div>
                                                                )}

                                                                {/* Action Buttons - Enhanced */}
                                                                <div className="space-y-2 pt-2">
                                                                    {/* View Button */}
                                                                    <button 
                                                                        onClick={() => setSelectedUser(user)} 
                                                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:shadow-lg text-white py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                                                                    >
                                                                        <Eye size={16} /> View Details
                                                                    </button>

                                                                    {/* Worker Specific Actions */}
                                                                    {user.role === 'worker' && user.verificationStatus === 'pending' && (
                                                                        (() => {
                                                                            if (!lockOwnerId) {
                                                                                return (
                                                                                    <button 
                                                                                        onClick={() => handleClaimWorker(user._id)} 
                                                                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg text-white py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                                                                                    >
                                                                                        <ShieldCheck size={16} /> Claim Review
                                                                                    </button>
                                                                                );
                                                                            }

                                                                            if (claimedByMe) {
                                                                                return (
                                                                                    <div className="flex gap-2">
                                                                                        <button 
                                                                                            onClick={() => setUserToVerify(user)} 
                                                                                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg text-white py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                                                                                        >
                                                                                            <Check size={16} /> Approve
                                                                                        </button>
                                                                                        <button 
                                                                                            onClick={() => {
                                                                                                const reason = window.prompt('Enter rejection reason:') || '';
                                                                                                handleStatusUpdate(user._id, 'rejected', 0, reason);
                                                                                            }}
                                                                                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-lg text-white py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                                                                                        >
                                                                                            <X size={16} /> Reject
                                                                                        </button>
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            if (claimedByOther) {
                                                                                return (
                                                                                    <div className="w-full bg-gray-300 text-gray-800 py-2.5 rounded-lg text-sm font-bold text-center">
                                                                                        🔒 Under Review
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            return null;
                                                                        })()
                                                                    )}

                                                                    {/* Approved Status Actions */}
                                                                    {user.role === 'worker' && user.verificationStatus === 'approved' && (
                                                                        <button 
                                                                            onClick={() => handleStatusUpdate(user._id, 'blocked')}
                                                                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:shadow-lg text-white py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                                                                        >
                                                                            <ShieldX size={16} /> Block Account
                                                                        </button>
                                                                    )}

                                                                    {/* Blocked Status Actions */}
                                                                    {user.role === 'worker' && user.verificationStatus === 'blocked' && (
                                                                        <button 
                                                                            onClick={() => handleStatusUpdate(user._id, 'unblocked')}
                                                                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg text-white py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                                                                        >
                                                                            <ShieldCheck size={16} /> Unblock Account
                                                                        </button>
                                                                    )}

                                                                    {/* Delete - Always Available */}
                                                                    <button 
                                                                        onClick={() => handleDelete(user._id, user.name, user.role)}
                                                                        className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-300 text-red-600 py-2 rounded-lg text-sm font-bold transition-all active:scale-95"
                                                                    >
                                                                        <Trash2 size={16} /> Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            </>
                                    ) : (
                                        <div className="text-center py-16 text-gray-400">
                                            <div className="text-4xl mb-4">📋</div>
                                            <p className="text-lg font-medium">No records found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {currentSection === 'fraud' && <FraudMonitor />}
                    {currentSection === 'users' && <AdminUsersSection />}
                    {currentSection === 'marketplace' && <AdminMarketplaceSection />}
                    {currentSection === 'leaderboard' && <AdminWorkerLeaderboardSection />}
                    {currentSection === 'direct-hires' && (
                        <div className="space-y-4">
                            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div>
                                        <h2 className="text-xl font-black text-gray-900">Payment Section</h2>
                                        <p className="text-sm text-gray-500">Track pending and completed direct hire payments with city and skill filtering.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDirectHireTab('pending')}
                                            className={`px-4 py-2 rounded-xl font-bold border ${directHireTab === 'pending' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200'}`}
                                        >
                                            Pending Payments
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDirectHireTab('completed')}
                                            className={`px-4 py-2 rounded-xl font-bold border ${directHireTab === 'completed' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-200'}`}
                                        >
                                            Completed Payments
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
                                    <select
                                        value={directHireCityFilter}
                                        onChange={(e) => setDirectHireCityFilter(e.target.value)}
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                    >
                                        <option value="all">All Cities</option>
                                        {directHireCityOptions.map((city) => (
                                            <option key={city} value={city.toLowerCase()}>{city}</option>
                                        ))}
                                    </select>

                                    <select
                                        value={directHireSkillFilter}
                                        onChange={(e) => setDirectHireSkillFilter(e.target.value)}
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                    >
                                        <option value="all">All Skills</option>
                                        {directHireSkillOptions.map((skill) => (
                                            <option key={skill} value={skill.toLowerCase()}>{skill}</option>
                                        ))}
                                    </select>

                                    <input
                                        type="text"
                                        value={directHireSearch}
                                        onChange={(e) => setDirectHireSearch(e.target.value)}
                                        placeholder="Search client name or phone"
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                    />

                                    <button
                                        type="button"
                                        onClick={fetchDirectHirePayments}
                                        className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold"
                                    >
                                        Refresh
                                    </button>
                                </div>

                                {directHireTab === 'completed' && (
                                    <div className="mt-3 text-sm font-bold text-emerald-700">
                                        Total Paid Amount: {formatMoney(directHireSummary.totalPaidAmount || 0)}
                                    </div>
                                )}
                            </div>

                            {directHireLoading ? (
                                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-gray-500">Loading payment records...</div>
                            ) : directHirePayments.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-gray-500">No payment records found for selected filters.</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {directHirePayments.map((row) => {
                                        const job = row?.job || {};
                                        const clientLocked = Boolean(job?.postedBy?.paymentLock?.active);
                                        return (
                                        <div key={job._id} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-900">{job.title}</h3>
                                                    <p className="text-sm text-gray-500">{job.postedBy?.name} • {job.postedBy?.mobile || 'N/A'}</p>
                                                </div>
                                                {row?.isOverdue ? (
                                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">Overdue • {row.overdueMinutes} min</span>
                                                ) : (
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${directHireTab === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                        {directHireTab === 'completed' ? 'Payment Done' : 'Pending'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                                <div><span className="font-semibold text-gray-800">Date & Time:</span> {formatJobDateTime(job)}</div>
                                                <div><span className="font-semibold text-gray-800">Duration:</span> {job?.directHire?.durationValue || 1} {job?.directHire?.durationUnit || '/day'}</div>
                                                <div><span className="font-semibold text-gray-800">City:</span> {job?.location?.city || row?.city || 'N/A'}</div>
                                                <div><span className="font-semibold text-gray-800">Address:</span> {job?.location?.fullAddress || 'N/A'}</div>
                                                <div><span className="font-semibold text-gray-800">Skill:</span> {row?.skill || (job?.skills || []).join(', ') || 'N/A'}</div>
                                                <div><span className="font-semibold text-gray-800">Payment Status:</span> {row?.paymentStatus || 'pending'}</div>
                                            </div>

                                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                                <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-2">Workers & Payments</p>
                                                <div className="space-y-2">
                                                    {(row?.paymentRows || []).map((pay, idx) => (
                                                        <div key={`${job._id}-worker-${idx}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                                            <div className="font-semibold text-gray-800">{pay.name} • {pay.mobile || 'N/A'}</div>
                                                            <div className="text-gray-700">{formatMoney(pay.amount || 0)} • {pay.method || 'cash'} {pay.paid ? '(Paid)' : '(Pending)'}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {directHireTab === 'pending' && (
                                                <div className="flex gap-2 flex-wrap">
                                                    <a
                                                        href={job?.postedBy?.mobile ? `tel:${job.postedBy.mobile}` : undefined}
                                                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                                                    >
                                                        Call Client
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleWarnClient(job._id)}
                                                        disabled={directHireActionLoading[`warn-${job._id}`]}
                                                        className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold disabled:opacity-60"
                                                    >
                                                        {directHireActionLoading[`warn-${job._id}`] ? 'Sending...' : 'Send Warning SMS'}
                                                    </button>
                                                    {!clientLocked ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleBlockClient(job._id)}
                                                            disabled={directHireActionLoading[`block-${job._id}`]}
                                                            className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold disabled:opacity-60"
                                                        >
                                                            {directHireActionLoading[`block-${job._id}`] ? 'Blocking...' : 'Block Services'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUnblockClient(job._id)}
                                                            disabled={directHireActionLoading[`unblock-${job._id}`]}
                                                            className="px-4 py-2 rounded-xl bg-green-600 text-white font-bold disabled:opacity-60"
                                                        >
                                                            {directHireActionLoading[`unblock-${job._id}`] ? 'Unblocking...' : 'Unblock Services'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    {currentSection === 'complaints' && <AdminComplaints />}
                    {currentSection === 'worker-complaints' && <AdminWorkerComplaints />}
                    {currentSection === 'community' && <AdminCommunity />}
                    {currentSection === 'shops' && <AdminShops />}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;