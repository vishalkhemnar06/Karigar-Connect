// src/pages/admin/AdminDashboard.jsx — ENHANCED v3
// Fixes:
//   1. Client export button lives inside the clients section table header only
//   2. Clients section: no "pending" status column (clients have no approval flow)
//   3. Export available for ALL sections: approved, rejected, blocked, clients
//   4. Color palette: warm slate/teal/amber/rose/sky — no harsh black
//   5. Header: cleaner and more professional, no extra functionality added
//   6. Platform Overview: full breakdown with 4 summary tiles + progress bars

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import logo from '../../assets/logo.jpg';
import {
    Check, X, ShieldX, Trash2, Eye, Users, UserCheck,
    UserX, Clock, ShieldCheck, Search, Download,
    ChevronDown, ChevronUp, Home, Mail, Phone,
    FileText, Briefcase,
    LogOut, Menu, X as CloseIcon, Calendar, Smartphone,
    MapPin as MapPinIcon,
    Camera, Award as AwardIcon, Star, TrendingUp,
    CheckCircle2, XCircle, Lock, ExternalLink,
    Badge, Shield, Activity, BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';

import AdminSidebar from '../../pages/admin/AdminSidebar';
import FraudMonitor from '../../pages/admin/FraudMonitor';
import AdminComplaints from '../../pages/admin/AdminComplaints';
import AdminWorkerComplaints from '../../pages/admin/AdminWorkerComplaints';
import AdminCommunity from '../../pages/admin/AdminCommunity';
import AdminShops from '../../pages/admin/AdminShops';

// ─────────────────────────────────────────────────────────────────────────────
// Status Pill
// ─────────────────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
    const map = {
        pending:  { bg: 'bg-amber-100',  text: 'text-amber-800',  ring: 'ring-amber-300',  dot: 'bg-amber-500',  label: 'Pending'  },
        approved: { bg: 'bg-teal-100',   text: 'text-teal-800',   ring: 'ring-teal-300',   dot: 'bg-teal-500',   label: 'Approved' },
        rejected: { bg: 'bg-rose-100',   text: 'text-rose-800',   ring: 'ring-rose-300',   dot: 'bg-rose-500',   label: 'Rejected' },
        blocked:  { bg: 'bg-slate-200',  text: 'text-slate-700',  ring: 'ring-slate-300',  dot: 'bg-slate-500',  label: 'Blocked'  },
    };
    const s = map[status] || map.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${s.bg} ${s.text} ${s.ring}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
            {s.label}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Action Button
// ─────────────────────────────────────────────────────────────────────────────
const ActionBtn = ({ color, icon: Icon, onClick, title }) => {
    const colors = {
        orange: 'bg-orange-100 text-orange-600 hover:bg-orange-200',
        blue:   'bg-sky-100    text-sky-700    hover:bg-sky-200',
        green:  'bg-teal-100   text-teal-600   hover:bg-teal-200',
        red:    'bg-rose-100   text-rose-600   hover:bg-rose-200',
        gray:   'bg-slate-100  text-slate-600  hover:bg-slate-200',
    };
    return (
        <button onClick={onClick} title={title}
            className={`p-2 rounded-xl transition-colors ${colors[color] || colors.gray}`}>
            <Icon size={14} />
        </button>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper for modals
// ─────────────────────────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
    <div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <span className="w-4 h-px bg-slate-300 inline-block"></span>
            {title}
            <span className="flex-1 h-px bg-slate-100 inline-block"></span>
        </h4>
        {children}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Verification Modal
// ─────────────────────────────────────────────────────────────────────────────
const VerificationModal = ({ worker, onClose, onConfirm }) => {
    const [points,   setPoints]   = useState(10);
    const [feedback, setFeedback] = useState('');
    if (!worker) return null;

    const experience = worker.experience || 0;
    const finalScore = Number(points) + (experience * 10);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="relative bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 p-6 text-white overflow-hidden">
                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full"></div>
                    <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full"></div>
                    <div className="relative flex justify-between items-start">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-orange-200 mb-1">Verification Review</div>
                            <h3 className="text-2xl font-black">{worker.name}</h3>
                            <p className="text-orange-100 text-sm mt-0.5">{worker.karigarId}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                            <CloseIcon size={18} />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <Star size={15} className="text-orange-500" /> Base Points (1–50)
                        </label>
                        <input
                            type="number" min="1" max="50" value={points}
                            onChange={(e) => setPoints(e.target.value)}
                            className="w-full border-2 border-orange-200 rounded-2xl p-3 text-3xl font-black text-center text-orange-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                        />
                    </div>
                    <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                        <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-3">Score Breakdown</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Admin Points</span>
                                <span className="font-mono font-bold text-slate-800">+{points || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Experience Bonus ({experience} yrs × 10)</span>
                                <span className="font-mono font-bold text-slate-800">+{experience * 10}</span>
                            </div>
                            <div className="border-t border-orange-200 pt-2 flex justify-between items-center">
                                <span className="font-black text-slate-800">Final Score</span>
                                <span className="font-black text-2xl text-orange-600">{finalScore}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Internal Notes</label>
                        <textarea
                            value={feedback} onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Background check notes, skill assessment..."
                            className="w-full border-2 border-slate-100 rounded-2xl p-3 h-24 focus:border-orange-400 outline-none text-sm transition-all resize-none"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { const r = window.prompt('Rejection reason:') || ''; onConfirm(worker._id, 'rejected', 0, r); }}
                            className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                        >Reject</button>
                        <button
                            onClick={() => { if (points >= 1 && points <= 50) onConfirm(worker._id, 'approved', points, feedback); }}
                            className="flex-[2] py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-100 hover:shadow-orange-200 active:scale-95 transition-all"
                        >Approve & Activate</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// User Details Modal — tabbed
// ─────────────────────────────────────────────────────────────────────────────
const UserDetailsModal = ({ user, onClose, baseURL }) => {
    const [activeTab, setActiveTab] = useState('personal');
    if (!user) return null;

    const address   = user.address          || {};
    const emergency = user.emergencyContact || {};
    const idDoc     = user.idProof          || {};

    const resolvePath = (value) => {
        if (!value) return null;
        const raw = typeof value === 'string' ? value : (value.filePath || value.path || null);
        if (!raw) return null;
        return raw.startsWith('http') ? raw : `${baseURL}${String(raw).replace(/^\//, '')}`;
    };

    const Field = ({ label, value, icon: Icon, mono }) => (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                {Icon && <Icon size={10} className="text-orange-400" />} {label}
            </p>
            <p className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
        </div>
    );

    const DocLink = ({ path, label }) => {
        const url = resolvePath(path);
        return url ? (
            <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100 hover:bg-orange-100 transition-colors group text-sm font-medium text-orange-700">
                <FileText size={14} className="flex-shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
        ) : (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-400">
                <FileText size={14} /> Not provided
            </div>
        );
    };

    const isWorker = user.role === 'worker';
    const tabs = isWorker
        ? [{ id: 'personal', label: 'Personal' }, { id: 'professional', label: 'Professional' }, { id: 'documents', label: 'Documents' }, { id: 'emergency', label: 'Emergency' }]
        : [{ id: 'personal', label: 'Personal' }, { id: 'security', label: 'Security' }, { id: 'profile', label: 'Profile' }, { id: 'documents', label: 'Documents' }];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className="bg-white w-full sm:rounded-3xl sm:shadow-2xl sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
                {/* Hero */}
                <div className="relative bg-gradient-to-br from-slate-700 via-slate-600 to-orange-700 p-5 sm:p-6 flex-shrink-0">
                    <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #EA580C 0%, transparent 55%)' }} />
                    <div className="relative flex items-center gap-4">
                        <div className="relative">
                            <img src={getImageUrl(user.photo)} alt={user.name}
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
                                onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                            <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black
                                ${user.verificationStatus === 'approved' ? 'bg-teal-500 text-white' :
                                  user.verificationStatus === 'pending'  ? 'bg-amber-400 text-white' : 'bg-rose-500 text-white'}`}>
                                {user.verificationStatus === 'approved' ? '✓' : user.verificationStatus === 'pending' ? '~' : '✕'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-orange-300 mb-0.5 capitalize">{user.role}</div>
                            <h3 className="text-xl sm:text-2xl font-black text-white truncate">{user.name}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] font-mono bg-white/10 text-orange-200 px-2 py-0.5 rounded-full">{user.karigarId}</span>
                                {user.verificationStatus && <StatusPill status={user.verificationStatus} />}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white flex-shrink-0">
                            <CloseIcon size={18} />
                        </button>
                    </div>
                    {isWorker && (
                        <div className="relative grid grid-cols-3 gap-2 mt-4">
                            {[
                                { label: 'Score',      value: user.points || 0,           icon: Star       },
                                { label: 'Experience', value: `${user.experience || 0}y`, icon: TrendingUp },
                                { label: 'Skills',     value: user.skills?.length || 0,   icon: Badge      },
                            ].map(({ label, value, icon: Icon }) => (
                                <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
                                    <Icon size={14} className="text-orange-300 mx-auto mb-1" />
                                    <div className="text-white font-black text-lg leading-none">{value}</div>
                                    <div className="text-orange-200 text-[10px] mt-0.5">{label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-white flex-shrink-0 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap px-3 transition-all
                                ${activeTab === tab.id ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50' : 'text-slate-400 hover:text-slate-600'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">

                    {activeTab === 'personal' && (
                        <>
                            <Section title="Identity">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <Field label="Full Name"      value={user.name}        icon={UserCheck} />
                                    <Field label="Mobile"         value={user.mobile}       icon={Phone} />
                                    <Field label="Email"          value={user.email}        icon={Mail} />
                                    <Field label="Gender"         value={user.gender} />
                                    <Field label="Age"            value={user.age} />
                                    <Field label="Date of Birth"  value={user.dob ? new Date(user.dob).toLocaleDateString('en-IN') : null} icon={Calendar} />
                                    <Field label="Phone Type"     value={user.phoneType}    icon={Smartphone} />
                                    <Field label="Aadhar No."     value={user.aadharNumber} mono />
                                    <Field label="E-Shram No."    value={user.eShramNumber} mono />
                                </div>
                            </Section>
                            <Section title="Address">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <div className="col-span-2 sm:col-span-3">
                                        <Field label="Full Address" value={address.fullAddress || user.fullAddress || address.homeLocation || user.homeLocation} icon={MapPinIcon} />
                                    </div>
                                    <Field label="City"     value={address.city     || user.city}     icon={Home} />
                                    <Field label="Village"  value={address.village  || user.village} />
                                    <Field label="Pincode"  value={address.pincode  || user.pincode}  mono />
                                    <Field label="Locality" value={address.locality || user.locality} />
                                    <Field label="House No."value={address.houseNumber || user.houseNumber} />
                                    <Field label="Lat/Lng"  value={address.latitude ? `${address.latitude}, ${address.longitude}` : null} mono />
                                </div>
                            </Section>
                        </>
                    )}

                    {activeTab === 'professional' && isWorker && (
                        <Section title="Experience & Skills">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <Field label="Overall Experience" value={user.overallExperience} />
                                <Field label="Years"              value={user.experience ? `${user.experience} years` : null} icon={TrendingUp} />
                            </div>
                            {user.skills?.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Skills</p>
                                    <div className="flex flex-wrap gap-2">
                                        {user.skills.map((s, i) => {
                                            const name = typeof s === 'object' ? s.name : s;
                                            const prof = typeof s === 'object' ? s.proficiency : null;
                                            return (
                                                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                                                    {name}{prof && <span className="text-orange-500"> · {prof}</span>}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </Section>
                    )}

                    {activeTab === 'emergency' && isWorker && (
                        <>
                            <Section title="Emergency Contact">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Name"   value={emergency.name   || user.emergencyContactName} />
                                    <Field label="Mobile" value={emergency.mobile || user.emergencyContactMobile} icon={Phone} />
                                </div>
                            </Section>
                            {user.references?.length > 0 && (
                                <Section title="References">
                                    <div className="space-y-3">
                                        {user.references.map((ref, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{ref.name}</p>
                                                    <p className="text-xs text-slate-500">{ref.contact}</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400">REF {i + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Section>
                            )}
                        </>
                    )}

                    {activeTab === 'security' && !isWorker && (
                        <>
                            <Section title="Verification">
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Age Verified (18+)', val: user.ageVerified },
                                        { label: 'Address Verified',   val: user.addressVerified },
                                    ].map(({ label, val }) => (
                                        <div key={label} className={`flex items-center gap-3 p-3 rounded-xl border ${val ? 'bg-teal-50 border-teal-100' : 'bg-rose-50 border-rose-100'}`}>
                                            {val ? <CheckCircle2 size={16} className="text-teal-600" /> : <XCircle size={16} className="text-rose-500" />}
                                            <span className="text-sm font-medium text-slate-700">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                            <Section title="Security Info">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Emergency Contact" value={emergency.name   || null} />
                                    <Field label="Emergency Mobile"  value={emergency.mobile || null} icon={Phone} />
                                    <Field label="Device Fingerprint" value={user.deviceFingerprint ? user.deviceFingerprint.slice(0, 16) + '…' : null} mono />
                                    <Field label="Signup IP"          value={user.signupIpAddress} mono />
                                </div>
                            </Section>
                            <Section title="Terms Accepted">
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Payment T&C',       val: user.termsPaymentAccepted },
                                        { label: 'Dispute Policy',    val: user.termsDisputePolicyAccepted },
                                        { label: 'Data Privacy',      val: user.termsDataPrivacyAccepted },
                                        { label: 'Worker Protection', val: user.termsWorkerProtectionAccepted },
                                    ].map(({ label, val }) => (
                                        <div key={label} className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium ${val ? 'bg-teal-50 text-teal-700' : 'bg-slate-50 text-slate-400'}`}>
                                            {val ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {label}
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        </>
                    )}

                    {activeTab === 'profile' && !isWorker && (
                        <Section title="Profile & Intent">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Profession"        value={user.profession || user.workplaceInfo} icon={Briefcase} />
                                <Field label="Signup Reason"     value={user.signupReason} />
                                <Field label="Prior Hiring"      value={user.previousHiringExperience === true ? 'Yes' : user.previousHiringExperience === false ? 'No' : null} />
                                <Field label="Payment Method"    value={user.preferredPaymentMethod} />
                                <Field label="Business Reg."     value={user.businessRegistrationNumber} mono />
                                <Field label="GST / Tax ID"      value={user.gstTaxId} mono />
                                <Field label="Insurance"         value={user.insuranceDetails} />
                                {user.socialProfile && (
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Social Profile</p>
                                        <a href={user.socialProfile} target="_blank" rel="noopener noreferrer"
                                            className="text-sm font-medium text-orange-600 hover:underline flex items-center gap-1">
                                            View <ExternalLink size={11} />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {activeTab === 'documents' && (
                        <>
                            <Section title="Core Documents">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <DocLink path={user.photo}                     label="Profile Photo" />
                                    <DocLink path={idDoc.filePath || user.idProof} label={`ID Proof (${idDoc.idType || user.idDocumentType || 'Aadhar'})`} />
                                </div>
                            </Section>
                            {isWorker && (
                                <>
                                    <Section title="Worker Documents">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <DocLink path={user.eShramCardPath || user.eShramCard} label="E-Shram Card" />
                                            <DocLink path={user.liveFacePhoto}                      label="Live Face Photo" />
                                        </div>
                                        {user.liveFacePhoto && (
                                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                                <Shield size={11} /> Similarity: {typeof user.faceVerificationScore === 'number' ? user.faceVerificationScore.toFixed(3) : 'N/A'} · {user.faceVerificationStatus || 'N/A'}
                                            </p>
                                        )}
                                    </Section>
                                    {user.skillCertificates?.length > 0 && (
                                        <Section title="Skill Certificates">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {user.skillCertificates.map((cert, i) => <DocLink key={i} path={cert} label={`Certificate ${i + 1}`} />)}
                                            </div>
                                        </Section>
                                    )}
                                    {user.portfolioPhotos?.length > 0 && (
                                        <Section title="Portfolio">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {user.portfolioPhotos.map((p, i) => <DocLink key={i} path={p} label={`Photo ${i + 1}`} />)}
                                            </div>
                                        </Section>
                                    )}
                                </>
                            )}
                            {!isWorker && (
                                <Section title="Client Documents">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <DocLink path={user.proofOfResidence}          label="Proof of Residence" />
                                        <DocLink path={user.secondaryIdProof}          label="Secondary ID Proof" />
                                        <DocLink path={user.professionalCertification} label="Professional Certification" />
                                        <DocLink path={user.liveFacePhoto}             label="Live Face Photo" />
                                    </div>
                                    {user.liveFacePhoto && (
                                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                            <Shield size={11} /> Similarity: {typeof user.faceVerificationScore === 'number' ? user.faceVerificationScore.toFixed(3) : 'N/A'} · {user.faceVerificationStatus || 'N/A'}
                                        </p>
                                    )}
                                </Section>
                            )}
                        </>
                    )}
                </div>

                <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 bg-slate-50 sm:rounded-b-3xl">
                    <button onClick={onClose}
                        className="w-full py-3 rounded-2xl font-bold text-sm bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Header — professional, light
// ─────────────────────────────────────────────────────────────────────────────
const DashboardHeader = ({ onLogout, onMenuToggle, isSidebarOpen, adminName }) => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const greetIcon = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';

    return (
        <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={onMenuToggle}
                        className="lg:hidden p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                        {isSidebarOpen ? <CloseIcon size={18} /> : <Menu size={18} />}
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img src={logo} alt="Logo"
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-sm" />
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white"></span>
                        </div>
                        <div>
                            <div className="font-black text-slate-900 text-base leading-tight tracking-tight">KarigarConnect</div>
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-orange-500">Admin Console</div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <span className="text-lg leading-none">{greetIcon}</span>
                        <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">{greeting}</p>
                            <p className="text-sm font-black text-slate-800 leading-tight mt-0.5">{adminName || 'Admin'}</p>
                        </div>
                    </div>
                    <button onClick={onLogout}
                        className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 px-3 py-2 rounded-xl transition-colors text-sm font-bold">
                        <LogOut size={15} />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Platform Overview — comprehensive
// ─────────────────────────────────────────────────────────────────────────────
const PlatformOverview = ({ stats }) => {
    const total = stats.totalWorkers || 1;
    const workerBreakdown = [
        { label: 'Approved', value: stats.approved, pct: Math.round((stats.approved / total) * 100), bar: 'bg-teal-500',  bg: 'bg-teal-50',  border: 'border-teal-200',  text: 'text-teal-700'  },
        { label: 'Pending',  value: stats.pending,  pct: Math.round((stats.pending  / total) * 100), bar: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
        { label: 'Rejected', value: stats.rejected, pct: Math.round((stats.rejected / total) * 100), bar: 'bg-rose-400',  bg: 'bg-rose-50',  border: 'border-rose-200',  text: 'text-rose-700'  },
        { label: 'Blocked',  value: stats.blocked,  pct: Math.round((stats.blocked  / total) * 100), bar: 'bg-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <BarChart3 size={11} /> Platform Overview
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">
                        {stats.totalWorkers + stats.totalClients}
                        <span className="text-slate-400 font-semibold text-base ml-2">total registered users</span>
                    </h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse inline-block"></span>
                    Live
                </div>
            </div>

            {/* 4 summary tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { label: 'Total Workers',   value: stats.totalWorkers,  sub: 'Registered karigar',   from: 'from-orange-500', to: 'to-amber-500',   sub2: 'text-orange-100' },
                    { label: 'Total Clients',   value: stats.totalClients,  sub: 'Registered clients',   from: 'from-sky-500',    to: 'to-indigo-500',  sub2: 'text-sky-100'    },
                    { label: 'Active Workers',  value: stats.approved,      sub: 'Approved & verified',  from: 'from-teal-500',   to: 'to-emerald-500', sub2: 'text-teal-100'   },
                    { label: 'Pending Review',  value: stats.pending,       sub: 'Awaiting verification',from: 'from-amber-500',  to: 'to-orange-400',  sub2: 'text-amber-100'  },
                ].map(t => (
                    <div key={t.label} className={`bg-gradient-to-br ${t.from} ${t.to} rounded-2xl p-4 text-white`}>
                        <div className={`text-[10px] font-bold uppercase tracking-widest ${t.sub2} mb-1`}>{t.label}</div>
                        <div className="text-3xl font-black leading-none">{t.value}</div>
                        <div className={`${t.sub2} text-xs mt-1.5 font-medium`}>{t.sub}</div>
                    </div>
                ))}
            </div>

            {/* Worker breakdown with progress */}
            <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Worker Verification Breakdown</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {workerBreakdown.map(m => (
                        <div key={m.label} className={`rounded-xl border p-3 ${m.bg} ${m.border}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-bold ${m.text}`}>{m.label}</span>
                                <span className={`text-xs font-black ${m.text}`}>{m.pct}%</span>
                            </div>
                            <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2">
                                <div className={`h-full rounded-full ${m.bar} transition-all duration-700`} style={{ width: `${m.pct}%` }}></div>
                            </div>
                            <div className={`text-2xl font-black ${m.text}`}>{m.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Stat / Filter Card
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, cc, onClick, active }) => (
    <button onClick={onClick}
        className={`relative bg-white rounded-2xl p-4 border-2 transition-all text-left w-full hover:shadow-md
            ${active ? `${cc.activeBorder} shadow-md ${cc.activeShadow}` : `${cc.border} hover:${cc.activeBorder}`}`}>
        <div className={`inline-flex p-2 rounded-xl mb-3 ${cc.iconBg}`}>
            <Icon size={16} className={cc.iconText} />
        </div>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">{title}</p>
        {active && <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${cc.dot}`}></span>}
    </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Mobile User Card
// ─────────────────────────────────────────────────────────────────────────────
const MobileUserCard = ({ user, currentAdminId, onViewDetails, onVerifyOpen, onClaimWorker, onStatusUpdate, onDelete }) => {
    const renderSkills = (skills) => {
        if (!skills || !Array.isArray(skills)) return '—';
        const names = skills.map(s => typeof s === 'object' ? s.name : s);
        return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
    };
    const lockOwnerId    = user?.reviewLock?.lockedBy?._id || user?.reviewLock?.lockedBy || null;
    const claimedByMe    = lockOwnerId && String(lockOwnerId) === String(currentAdminId);
    const claimedByOther = lockOwnerId && !claimedByMe;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img src={getImageUrl(user.photo)} alt={user.name}
                            className="w-11 h-11 rounded-xl object-cover border-2 border-slate-100"
                            onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                        {user.role === 'worker' && user.verificationStatus && (
                            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white text-[7px] flex items-center justify-center font-black
                                ${user.verificationStatus === 'approved' ? 'bg-teal-500 text-white' :
                                  user.verificationStatus === 'pending'  ? 'bg-amber-400 text-white' : 'bg-rose-500 text-white'}`}>
                                {user.verificationStatus === 'approved' ? '✓' : user.verificationStatus === 'pending' ? '~' : '✕'}
                            </span>
                        )}
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 text-sm">{user.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">{user.role}</p>
                    </div>
                </div>
                <span className="bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold">{user.karigarId}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 text-xs bg-slate-50 rounded-xl p-3">
                <div>
                    <p className="text-slate-400 font-semibold mb-0.5">Mobile</p>
                    <p className="font-semibold text-slate-700">{user.mobile}</p>
                </div>
                <div>
                    <p className="text-slate-400 font-semibold mb-0.5">{user.role === 'client' ? 'Email' : 'Skills'}</p>
                    <p className="font-semibold text-slate-700 truncate">{user.role === 'worker' ? renderSkills(user.skills) : user.email}</p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Status pill only for workers */}
                {user.role === 'worker' && <StatusPill status={user.verificationStatus} />}
                <div className="flex gap-1.5 ml-auto">
                    <ActionBtn color="orange" icon={Eye} onClick={() => onViewDetails(user)} />
                    {user.role === 'worker' && user.verificationStatus === 'pending' && !lockOwnerId && (
                        <ActionBtn color="blue" icon={ShieldCheck} onClick={() => onClaimWorker(user._id)} title="Claim" />
                    )}
                    {user.role === 'worker' && user.verificationStatus === 'pending' && claimedByMe && (
                        <>
                            <ActionBtn color="green" icon={Check} onClick={() => onVerifyOpen(user)} />
                            <ActionBtn color="red"   icon={X}     onClick={() => { const r = window.prompt('Rejection reason:') || ''; onStatusUpdate(user._id, 'rejected', 0, r); }} />
                        </>
                    )}
                    {user.role === 'worker' && user.verificationStatus === 'pending' && claimedByOther && (
                        <span className="px-2 py-1 text-[10px] rounded-lg bg-slate-100 text-slate-500 font-bold flex items-center gap-1"><Lock size={10} /> Locked</span>
                    )}
                    {user.role === 'worker' && user.verificationStatus === 'approved' && (
                        <ActionBtn color="gray" icon={ShieldX}    onClick={() => onStatusUpdate(user._id, 'blocked')} title="Block" />
                    )}
                    {user.role === 'worker' && user.verificationStatus === 'blocked' && (
                        <ActionBtn color="green" icon={ShieldCheck} onClick={() => onStatusUpdate(user._id, 'unblocked')} title="Unblock" />
                    )}
                    <ActionBtn color="red" icon={Trash2} onClick={() => onDelete(user._id, user.name, user.role)} />
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Export utilities
// ─────────────────────────────────────────────────────────────────────────────
const writeExcel = (rows, sheetName, filename) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

const exportWorkersExcel = (data, filterLabel) => {
    if (!data.length) { alert('No records to export.'); return; }
    const renderSkills = (skills) => !skills?.length ? '' : skills.map(s => typeof s === 'object' ? `${s.name}(${s.proficiency})` : s).join(', ');
    const rows = data.map(w => ({
        'Karigar ID':                 w.karigarId,
        'Full Name':                  w.name,
        'Role':                       w.role,
        'Mobile':                     w.mobile,
        'Email':                      w.email || '',
        'Gender':                     w.gender || '',
        'Age':                        w.age || '',
        'Date of Birth':              w.dob ? new Date(w.dob).toLocaleDateString('en-IN') : '',
        'Phone Type':                 w.phoneType || '',
        'Aadhar Number':              w.aadharNumber || '',
        'E-Shram Number':             w.eShramNumber || '',
        'City':                       w.city || w.address?.city || '',
        'Village':                    w.village || w.address?.village || '',
        'Pincode':                    w.pincode || w.address?.pincode || '',
        'Locality':                   w.locality || w.address?.locality || '',
        'Full Address':               w.fullAddress || w.address?.fullAddress || '',
        'Latitude':                   w.address?.latitude ?? w.latitude ?? '',
        'Longitude':                  w.address?.longitude ?? w.longitude ?? '',
        'Overall Experience':         w.overallExperience || '',
        'Experience (Years)':         w.experience || '',
        'Skills':                     renderSkills(w.skills),
        'Ranking Score':              w.points || 0,
        'Verification Status':        w.verificationStatus,
        'Emergency Contact Name':     w.emergencyContact?.name   || w.emergencyContactName   || '',
        'Emergency Contact Mobile':   w.emergencyContact?.mobile || w.emergencyContactMobile || '',
        'Joined On':                  w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-IN') : '',
    }));
    writeExcel(rows, `${filterLabel} Workers`, `${filterLabel.toLowerCase()}_workers`);
};

const exportClientsExcel = (clients) => {
    if (!clients.length) { alert('No clients to export.'); return; }
    const rows = clients.map(c => ({
        'Karigar ID':                   c.karigarId,
        'Full Name':                    c.name,
        'Mobile':                       c.mobile,
        'Email':                        c.email || '',
        'Gender':                       c.gender || '',
        'Age':                          c.age || '',
        'Date of Birth':                c.dob ? new Date(c.dob).toLocaleDateString('en-IN') : '',
        'Aadhar Number':                c.aadharNumber || '',
        'City':                         c.city || c.address?.city || '',
        'Full Address':                 c.fullAddress || c.address?.fullAddress || '',
        'Pincode':                      c.pincode || c.address?.pincode || '',
        'Profession':                   c.profession || c.workplaceInfo || '',
        'Signup Reason':                c.signupReason || '',
        'Prior Hiring Experience':      c.previousHiringExperience === true ? 'Yes' : c.previousHiringExperience === false ? 'No' : '',
        'Preferred Payment':            c.preferredPaymentMethod || '',
        'Business Reg. No.':            c.businessRegistrationNumber || '',
        'GST / Tax ID':                 c.gstTaxId || '',
        'Age Verified':                 c.ageVerified ? 'Yes' : 'No',
        'Address Verified':             c.addressVerified ? 'Yes' : 'No',
        'Payment T&C Accepted':         c.termsPaymentAccepted ? 'Yes' : 'No',
        'Dispute Policy Accepted':      c.termsDisputePolicyAccepted ? 'Yes' : 'No',
        'Data Privacy Accepted':        c.termsDataPrivacyAccepted ? 'Yes' : 'No',
        'Worker Protection Accepted':   c.termsWorkerProtectionAccepted ? 'Yes' : 'No',
        'Face Verification Status':     c.faceVerificationStatus || '',
        'Face Similarity Score':        typeof c.faceVerificationScore === 'number' ? c.faceVerificationScore.toFixed(3) : '',
        'Signup IP':                    c.signupIpAddress || '',
        'Emergency Contact Name':       c.emergencyContact?.name   || '',
        'Emergency Contact Mobile':     c.emergencyContact?.mobile || '',
        'Joined On':                    c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '',
    }));
    writeExcel(rows, 'Clients', 'clients');
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const [workers,        setWorkers]        = useState([]);
    const [clients,        setClients]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [selectedUser,   setSelectedUser]   = useState(null);
    const [userToVerify,   setUserToVerify]   = useState(null);
    const [activeFilter,   setActiveFilter]   = useState('pending');
    const [searchTerm,     setSearchTerm]     = useState('');
    const [sortConfig,     setSortConfig]     = useState({ key: null, direction: 'asc' });
    const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);
    const [isLoggedIn,     setIsLoggedIn]     = useState(true);
    const [currentSection, setCurrentSection] = useState('dashboard');

    const navigate = useNavigate();
    const baseURL = `${window.location.protocol}//${window.location.hostname}:5000/`;

    const { currentAdminId, adminName } = useMemo(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return { currentAdminId: user?.id ? String(user.id) : null, adminName: user?.name || 'Admin' };
        } catch { return { currentAdminId: null, adminName: 'Admin' }; }
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;
        const handler = (e) => { e.preventDefault(); window.history.forward(); };
        window.history.pushState(null, null, window.location.pathname);
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, [isLoggedIn]);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [wr, cr] = await Promise.all([api.getAllWorkers(), api.getAllClients()]);
            setWorkers(wr.data);
            setClients(cr.data);
        } catch {}
        finally { if (!silent) setLoading(false); }
    };
    useEffect(() => { fetchData(); }, []);
    useEffect(() => {
        if (activeFilter !== 'pending') return;
        const id = setInterval(() => fetchData(true), 15000);
        return () => clearInterval(id);
    }, [activeFilter]);

    const handleLogout = () => {
        setIsLoggedIn(false);
        ['token', 'role', 'user'].forEach(k => localStorage.removeItem(k));
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
        let data = activeFilter === 'clients'
            ? clients
            : workers.filter(w => w.verificationStatus === activeFilter);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            data = data.filter(u =>
                u.name?.toLowerCase().includes(q) ||
                u.mobile?.includes(q) ||
                u.karigarId?.toLowerCase().includes(q));
        }
        if (sortConfig.key) {
            data = [...data].sort((a, b) => {
                const av = a[sortConfig.key], bv = b[sortConfig.key];
                if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
                if (av > bv) return sortConfig.direction === 'asc' ?  1 : -1;
                return 0;
            });
        }
        return data;
    }, [activeFilter, workers, clients, searchTerm, sortConfig]);

    const handleSort         = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    const handleStatusUpdate = async (workerId, status, points = 0, feedback = '') => {
        try { await api.updateWorkerStatus({ workerId, status, points: Number(points), rejectionReason: feedback }); setUserToVerify(null); fetchData(true); } catch {}
    };
    const handleClaimWorker  = async (workerId) => { try { await api.claimWorkerForReview(workerId); fetchData(true); } catch {} };
    const handleDelete       = async (userId, name, role) => {
        if (!window.confirm(`Delete ${role}: ${name}?`)) return;
        try { await api.deleteUser(userId); fetchData(); } catch {}
    };

    const handleExport = () => {
        const label = activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1);
        if (activeFilter === 'clients') exportClientsExcel(filteredData);
        else exportWorkersExcel(filteredData, label);
    };

    // Show export for: approved, rejected, blocked, clients (not pending)
    const showExport = ['approved', 'rejected', 'blocked', 'clients'].includes(activeFilter);

    const statCards = [
        { key: 'pending',  label: 'Pending',  value: stats.pending,      icon: Clock,     cc: { border: 'border-amber-100',  activeBorder: 'border-amber-400',  activeShadow: 'shadow-amber-100', iconBg: 'bg-amber-100',  iconText: 'text-amber-600',  dot: 'bg-amber-500'  } },
        { key: 'approved', label: 'Approved', value: stats.approved,     icon: UserCheck, cc: { border: 'border-teal-100',   activeBorder: 'border-teal-400',   activeShadow: 'shadow-teal-100',  iconBg: 'bg-teal-100',   iconText: 'text-teal-600',   dot: 'bg-teal-500'   } },
        { key: 'rejected', label: 'Rejected', value: stats.rejected,     icon: UserX,     cc: { border: 'border-rose-100',   activeBorder: 'border-rose-400',   activeShadow: 'shadow-rose-100',  iconBg: 'bg-rose-100',   iconText: 'text-rose-600',   dot: 'bg-rose-500'   } },
        { key: 'blocked',  label: 'Blocked',  value: stats.blocked,      icon: ShieldX,   cc: { border: 'border-slate-200',  activeBorder: 'border-slate-400',  activeShadow: 'shadow-slate-100', iconBg: 'bg-slate-100',  iconText: 'text-slate-600',  dot: 'bg-slate-500'  } },
        { key: 'clients',  label: 'Clients',  value: stats.totalClients, icon: Users,     cc: { border: 'border-sky-100',    activeBorder: 'border-sky-400',    activeShadow: 'shadow-sky-100',   iconBg: 'bg-sky-100',    iconText: 'text-sky-600',    dot: 'bg-sky-500'    } },
    ];

    const SortHeader = ({ label, sortKey }) => (
        <button onClick={() => handleSort(sortKey)}
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-orange-600 transition-colors">
            {label}
            {sortConfig.key === sortKey ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} baseURL={baseURL} />
            <VerificationModal worker={userToVerify} onClose={() => setUserToVerify(null)} onConfirm={handleStatusUpdate} />

            <DashboardHeader
                onLogout={handleLogout}
                onMenuToggle={() => setIsSidebarOpen(p => !p)}
                isSidebarOpen={isSidebarOpen}
                adminName={adminName}
            />

            <div className="flex">
                <AdminSidebar
                    isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
                    activeFilter={activeFilter} onFilterChange={setActiveFilter}
                    currentSection={currentSection} onSectionChange={setCurrentSection}
                    stats={stats}
                />

                <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 min-w-0 overflow-auto">
                    {currentSection === 'dashboard' && (
                        <>
                            {/* Page title row — search only, no stray export */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Admin Control Desk</h1>
                                    <p className="text-slate-400 text-sm mt-0.5">
                                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                                <div className="relative">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text" placeholder="Search by name, mobile, ID…" value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-orange-400 focus:ring-4 focus:ring-orange-50 w-full sm:w-64 text-sm outline-none transition-all bg-white"
                                    />
                                </div>
                            </div>

                            {/* Platform Overview */}
                            <PlatformOverview stats={stats} />

                            {/* Filter cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                                {statCards.map(card => (
                                    <StatCard key={card.key} title={card.label} value={card.value} icon={card.icon}
                                        cc={card.cc} active={activeFilter === card.key} onClick={() => setActiveFilter(card.key)} />
                                ))}
                            </div>

                            {/* Records table */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="font-black text-slate-900 capitalize">
                                            {activeFilter === 'clients' ? 'All Clients' : `${activeFilter} Workers`}
                                        </h3>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    {/* Export only in approved/rejected/blocked/clients sections */}
                                    {showExport && (
                                        <button onClick={handleExport}
                                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm shadow-teal-200 flex-shrink-0">
                                            <Download size={14} />
                                            Export Excel
                                        </button>
                                    )}
                                </div>

                                <div className="p-4 sm:p-5">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-slate-400 text-sm font-medium">Loading records…</p>
                                        </div>
                                    ) : filteredData.length === 0 ? (
                                        <div className="text-center py-16">
                                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                                <Search size={24} className="text-slate-300" />
                                            </div>
                                            <p className="text-slate-600 font-semibold">No records found</p>
                                            <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Mobile cards */}
                                            <div className="lg:hidden">
                                                {filteredData.map(user => (
                                                    <MobileUserCard key={user._id} user={user} currentAdminId={currentAdminId}
                                                        onViewDetails={setSelectedUser} onVerifyOpen={setUserToVerify}
                                                        onClaimWorker={handleClaimWorker} onStatusUpdate={handleStatusUpdate} onDelete={handleDelete} />
                                                ))}
                                            </div>

                                            {/* Desktop table */}
                                            <div className="hidden lg:block overflow-x-auto">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="border-b border-slate-100">
                                                            <th className="pb-3 text-left pl-1"><SortHeader label="Name"   sortKey="name" /></th>
                                                            <th className="pb-3 text-left"><SortHeader label="ID"     sortKey="karigarId" /></th>
                                                            <th className="pb-3 text-left"><SortHeader label="Mobile" sortKey="mobile" /></th>
                                                            <th className="pb-3 text-left">{activeFilter === 'clients' ? 'Email' : 'Score / Skills'}</th>
                                                            {/* Status column hidden for clients */}
                                                            {activeFilter !== 'clients' && <th className="pb-3 text-left">Status</th>}
                                                            <th className="pb-3 text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {filteredData.map(user => {
                                                            const lockOwnerId    = user?.reviewLock?.lockedBy?._id || user?.reviewLock?.lockedBy || null;
                                                            const claimedByMe    = lockOwnerId && String(lockOwnerId) === String(currentAdminId);
                                                            const claimedByOther = lockOwnerId && !claimedByMe;
                                                            return (
                                                                <tr key={user._id} className="hover:bg-orange-50/20 transition-colors group">
                                                                    <td className="py-3.5 pr-4 pl-1">
                                                                        <div className="flex items-center gap-3">
                                                                            <img src={getImageUrl(user.photo)} alt={user.name}
                                                                                className="w-10 h-10 rounded-xl object-cover border-2 border-slate-100 group-hover:border-orange-200 transition-colors flex-shrink-0"
                                                                                onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                                                                            <div>
                                                                                <p className="font-bold text-slate-800 text-sm">{user.name}</p>
                                                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider capitalize">{user.role}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3.5 pr-4">
                                                                        <span className="font-mono text-[11px] bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded-lg">{user.karigarId}</span>
                                                                    </td>
                                                                    <td className="py-3.5 pr-4 text-sm text-slate-600">{user.mobile}</td>
                                                                    <td className="py-3.5 pr-4">
                                                                        {user.role === 'worker' ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-lg text-[11px] font-black">#{user.points || 0}</span>
                                                                                <span className="text-xs text-slate-400">{user.experience}y exp</span>
                                                                            </div>
                                                                        ) : <span className="text-sm text-slate-600">{user.email}</span>}
                                                                    </td>
                                                                    {/* No status column for clients */}
                                                                    {activeFilter !== 'clients' && (
                                                                        <td className="py-3.5 pr-4">
                                                                            <StatusPill status={user.verificationStatus} />
                                                                            {user.verificationStatus === 'pending' && lockOwnerId && (
                                                                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                                                    <Lock size={9} /> {user.reviewLock.lockedBy.name || 'Admin'}
                                                                                </p>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                    <td className="py-3.5">
                                                                        <div className="flex justify-end items-center gap-1.5">
                                                                            <ActionBtn color="orange" icon={Eye}   onClick={() => setSelectedUser(user)} title="View" />
                                                                            {user.role === 'worker' && user.verificationStatus === 'pending' && !lockOwnerId && (
                                                                                <ActionBtn color="blue" icon={ShieldCheck} onClick={() => handleClaimWorker(user._id)} title="Claim" />
                                                                            )}
                                                                            {user.role === 'worker' && user.verificationStatus === 'pending' && claimedByMe && (
                                                                                <>
                                                                                    <ActionBtn color="green" icon={Check} onClick={() => setUserToVerify(user)} title="Verify" />
                                                                                    <ActionBtn color="red"   icon={X}     onClick={() => { const r = window.prompt('Rejection reason:') || ''; handleStatusUpdate(user._id, 'rejected', 0, r); }} title="Reject" />
                                                                                </>
                                                                            )}
                                                                            {user.role === 'worker' && user.verificationStatus === 'pending' && claimedByOther && (
                                                                                <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-500 flex items-center gap-1">
                                                                                    <Lock size={9} /> Locked
                                                                                </span>
                                                                            )}
                                                                            {user.role === 'worker' && user.verificationStatus === 'approved' && (
                                                                                <ActionBtn color="gray" icon={ShieldX}    onClick={() => handleStatusUpdate(user._id, 'blocked')} title="Block" />
                                                                            )}
                                                                            {user.role === 'worker' && user.verificationStatus === 'blocked' && (
                                                                                <ActionBtn color="green" icon={ShieldCheck} onClick={() => handleStatusUpdate(user._id, 'unblocked')} title="Unblock" />
                                                                            )}
                                                                            <ActionBtn color="red" icon={Trash2} onClick={() => handleDelete(user._id, user.name, user.role)} title="Delete" />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {currentSection === 'fraud'             && <FraudMonitor />}
                    {currentSection === 'complaints'        && <AdminComplaints />}
                    {currentSection === 'worker-complaints' && <AdminWorkerComplaints />}
                    {currentSection === 'community'         && <AdminCommunity />}
                    {currentSection === 'shops'             && <AdminShops />}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;