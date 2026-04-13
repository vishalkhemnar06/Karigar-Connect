// client/src/pages/auth/ClientRegister.jsx
// CHANGE: Face verification modal is shown when user clicks "Create Account".
// After liveness passes, the live photo is included in FormData.
// All other form fields are UNCHANGED.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import FaceVerification, { dataURLtoBlob } from './FaceVerification';
import {
    Eye,
    EyeOff,
    User,
    Mail,
    Phone,
    MapPin,
    FileText,
    Briefcase,
    Shield,
    Camera,
    ArrowLeft,
    CheckCircle,
    X,
} from 'lucide-react';
import { PASSWORD_POLICY_TEXT, getPasswordStrength, isStrongPassword } from '../../constants/passwordPolicy';

const ClientRegister = () => {
    const [formData, setFormData] = useState({
        // Basic
        name:'', mobile:'', email:'', password:'', confirmPassword:'',
        age:'', dob:'', gender:'',
        // Address
        city:'', pincode:'', locality:'', homeLocation:'', houseNumber:'', fullAddress:'', village:'', latitude:'', longitude:'',
        // ID & Documents
        idType:'Aadhar', workplaceInfo:'', socialProfile:'',
        // NEW HIGH PRIORITY Security Fields
        ageVerified: false, emergencyContactName:'', emergencyContactMobile:'',
        // NEW MEDIUM PRIORITY Fields
        profession:'', signupReason:'', previousHiringExperience: null, preferredPaymentMethod:'',
        businessRegistrationNumber:'', gstTaxId:'', insuranceDetails:'',
        securityQuestion:'', securityAnswer:'',
        // NEW T&C Checkboxes (separate from legacy agreedToTerms)
        termsPaymentAccepted: false,
        termsDisputePolicyAccepted: false,
        termsDataPrivacyAccepted: false,
        termsWorkerProtectionAccepted: false,
    });
    const [files, setFiles] = useState({ 
        photo:null, idProof:null,
        // NEW files
        proofOfResidence: null,
        secondaryIdProof: null,
        professionalCertification: null,
    });

    // OTP state
    const [mobileOtp,        setMobileOtp]        = useState('');
    const [emailOtp,         setEmailOtp]          = useState('');
    const [mobileOtpSent,    setMobileOtpSent]     = useState(false);
    const [emailOtpSent,     setEmailOtpSent]      = useState(false);
    const [mobileVerified,   setMobileVerified]    = useState(false);
    const [emailVerified,    setEmailVerified]     = useState(false);

    // Face verification state
    const [showFaceVerif,    setShowFaceVerif]     = useState(false);
    const [livePhotoData,    setLivePhotoData]     = useState(null); // dataURL after liveness
    const [checkingSimilarity, setCheckingSimilarity] = useState(false);
    const [similarity, setSimilarity] = useState(null);
    const [similarityThreshold, setSimilarityThreshold] = useState(0.5);
    const [faceMatchPassed, setFaceMatchPassed] = useState(false);
    const [faceMessage, setFaceMessage] = useState('');
    const [activeSection, setActiveSection] = useState(0);
    // REMOVED: agreedToTerms - replaced with separate T&C checkboxes in formData
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [locationError, setLocationError] = useState('');
    const [legalPreview, setLegalPreview] = useState({ open: false, title: '', path: '' });

    const navigate = useNavigate();
    const strength = getPasswordStrength(formData.password);

    const handleChange     = e => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleFileChange = e => {
        const { name, files: selectedFiles } = e.target;
        const file = selectedFiles?.[0] || null;
        setFiles({ ...files, [name]: file });

        if (name === 'idProof') {
            setSimilarity(null);
            setFaceMatchPassed(false);
            setFaceMessage('ID proof changed. Please run face verification again.');
        }
    };

    const captureLocation = async () => {
        setLocationError('');
        if (!navigator.geolocation) {
            const msg = 'Geolocation is not supported by your browser.';
            setLocationError(msg);
            toast.error(msg);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setFormData((prev) => ({
                    ...prev,
                    latitude: latitude.toFixed(6),
                    longitude: longitude.toFixed(6),
                }));

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    );
                    const data = await response.json();
                    const addr = data?.address || {};

                    const houseNum = addr.house_number || '';
                    const roadName = addr.road || addr.street || '';
                    const fullAddress = [houseNum, roadName].filter(Boolean).join(', ');
                    const cityName = addr.city || addr.town || addr.county || '';
                    const villageName = addr.village || addr.hamlet || addr.suburb || '';
                    const pincode = addr.postcode || '';

                    setFormData((prev) => ({
                        ...prev,
                        fullAddress: fullAddress || prev.fullAddress,
                        city: cityName || prev.city,
                        village: villageName || prev.village,
                        locality: villageName || prev.locality,
                        homeLocation: fullAddress || villageName || prev.homeLocation,
                        pincode: pincode || prev.pincode,
                    }));

                    toast.success('Live location captured and address auto-filled.');
                } catch {
                    toast.success('Live location captured. Fill remaining fields manually.');
                }
            },
            (error) => {
                let msg = 'Unable to capture live location.';
                if (error.code === error.PERMISSION_DENIED) msg = 'Location permission denied. Enable location access.';
                else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location information unavailable.';
                else if (error.code === error.TIMEOUT) msg = 'Location request timed out. Please try again.';
                setLocationError(msg);
                toast.error(msg);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    // OTP handlers (unchanged)
    const handleSendMobileOtp = async () => {
        if (!formData.mobile || formData.mobile.length !== 10) return toast.error('Valid 10-digit mobile required');
        const id = toast.loading('Sending Mobile OTP…');
        try { await api.sendOtp({ mobile: formData.mobile }); setMobileOtpSent(true); toast.success('OTP sent!', { id }); }
        catch { toast.error('Failed to send mobile OTP', { id }); }
    };
    const handleVerifyMobileOtp = async () => {
        if (!mobileOtp) return toast.error('Enter mobile OTP');
        const id = toast.loading('Verifying…');
        try { await api.verifyOtp({ identifier: formData.mobile, otp: mobileOtp }); setMobileVerified(true); toast.success('Mobile verified!', { id }); }
        catch { toast.error('Invalid Mobile OTP', { id }); }
    };
    const handleSendEmailOtp = async () => {
        if (!formData.email) return toast.error('Enter email address');
        const id = toast.loading('Sending Email OTP…');
        try { await api.sendOtp({ email: formData.email }); setEmailOtpSent(true); toast.success('OTP sent to email!', { id }); }
        catch { toast.error('Failed to send email OTP', { id }); }
    };
    const handleVerifyEmailOtp = async () => {
        if (!emailOtp) return toast.error('Enter email OTP');
        const id = toast.loading('Verifying…');
        try { await api.verifyOtp({ identifier: formData.email, otp: emailOtp }); setEmailVerified(true); toast.success('Email verified!', { id }); }
        catch { toast.error('Invalid Email OTP', { id }); }
    };

    // ── Step validation helpers ───────────────────────────────────────────────
    const validatePreFaceRequirements = () => {
        if (!mobileVerified || !emailVerified) return toast.error('Verify both mobile and email first.');
        const ageNum = Number(formData.age);
        if (!Number.isFinite(ageNum) || ageNum <= 0) return toast.error('Age must be a positive number.');
        if (ageNum < 18) return toast.error('Age must be 18 or above.');
        if (!formData.dob) return toast.error('Birth date is required.');
        const dobDate = new Date(formData.dob);
        if (Number.isNaN(dobDate.getTime())) return toast.error('Birth date is invalid.');
        if (dobDate > new Date()) return toast.error('Birth date cannot be in the future.');
        if (!formData.gender) return toast.error('Gender is required.');
        if (formData.password !== formData.confirmPassword) return toast.error("Passwords don't match");
        if (!isStrongPassword(formData.password)) return toast.error(PASSWORD_POLICY_TEXT);
        if (!formData.fullAddress || !formData.city || !formData.village || !formData.pincode || !formData.latitude || !formData.longitude) {
            return toast.error('Please complete full address, village, pincode, latitude and longitude.');
        }
        if (!files.photo) return toast.error('Upload profile photo first.');
        if (!files.idProof) return toast.error('Upload ID proof before face verification.');
        // NEW: Validate security fields
        if (!formData.emergencyContactName?.trim()) return toast.error('Emergency contact name required.');
        if (!formData.emergencyContactMobile?.trim()) return toast.error('Emergency contact mobile required.');
        // NEW: Validate all T&C acceptance
        if (!formData.termsPaymentAccepted) return toast.error('Accept payment terms to continue.');
        if (!formData.termsDisputePolicyAccepted) return toast.error('Accept dispute policy to continue.');
        if (!formData.termsDataPrivacyAccepted) return toast.error('Accept data privacy policy to continue.');
        if (!formData.termsWorkerProtectionAccepted) return toast.error('Accept worker protection terms to continue.');
        return true;
    };

    const goToAddressSection = () => {
        if (!formData.name?.trim()) return toast.error('Enter your name.');
        if (!mobileVerified || !emailVerified) return toast.error('Verify mobile and email before continuing.');
        const ageNum = Number(formData.age);
        if (!Number.isFinite(ageNum) || ageNum <= 0) return toast.error('Age must be a positive number.');
        if (ageNum < 18) return toast.error('You must be 18 or older to register.');
        if (!formData.dob) return toast.error('Enter your birth date.');
        const dobDate = new Date(formData.dob);
        if (Number.isNaN(dobDate.getTime()) || dobDate > new Date()) return toast.error('Enter a valid birth date.');
        if (!formData.gender) return toast.error('Select gender.');
        // NEW: Validate security fields
        if (!formData.emergencyContactName?.trim()) return toast.error('Enter emergency contact name.');
        if (!formData.emergencyContactMobile?.trim() || formData.emergencyContactMobile.length !== 10) return toast.error('Enter valid 10-digit emergency contact mobile.');
        setActiveSection(1);
    };

    const openLegalPreview = (title, path) => {
        const previewPath = path.includes('?') ? `${path}&embed=1` : `${path}?embed=1`;
        setLegalPreview({ open: true, title, path: previewPath });
    };

    const closeLegalPreview = () => {
        setLegalPreview({ open: false, title: '', path: '' });
    };

    const goToProfileSection = () => {
        if (!formData.fullAddress || !formData.city || !formData.village || !formData.pincode || !formData.latitude || !formData.longitude) {
            return toast.error('Complete address details and location coordinates.');
        }
        setActiveSection(2);
    };

    const goToOptionalSection = () => {
        if (!files.photo) return toast.error('Upload profile photo.');
        if (!files.idProof) return toast.error('Upload ID proof.');
        setActiveSection(3);
    };

    const goToPasswordSection = () => {
        setActiveSection(4);
    };

    const goToFaceSection = () => {
        const ok = validatePreFaceRequirements();
        if (!ok) return;
        setActiveSection(5);
    };

    const startFaceVerification = () => {
        const ok = validatePreFaceRequirements();
        if (!ok) return;
        setShowFaceVerif(true);
    };

    const runFaceSimilarityCheck = async (photoDataUrl) => {
        if (!files.idProof || !photoDataUrl) return;
        setCheckingSimilarity(true);
        setFaceMatchPassed(false);
        setFaceMessage('Checking similarity with your uploaded ID...');
        try {
            const fd = new FormData();
            fd.append('idProof', files.idProof);
            fd.append('livePhoto', dataURLtoBlob(photoDataUrl), 'live_face.jpg');
            const { data } = await api.previewFaceSimilarity(fd);
            setSimilarity(typeof data.similarity === 'number' ? data.similarity : null);
            setSimilarityThreshold(typeof data.threshold === 'number' ? data.threshold : 0.5);
            setFaceMatchPassed(!!data.passed);
            setFaceMessage(data.message || (data.passed ? 'Face match passed.' : 'Face match failed.'));
            if (data.passed) toast.success('Face similarity check passed.');
            else toast.error('Face similarity below threshold. Please retry face verification.');
        } catch (err) {
            const msg = err.response?.data?.message || 'Could not check face similarity right now.';
            setFaceMessage(msg);
            setFaceMatchPassed(false);
            toast.error(msg);
        } finally {
            setCheckingSimilarity(false);
        }
    };

    // ── Face verification complete ────────────────────────────────────────────
    const handleFaceComplete = async ({ photoDataUrl }) => {
        setLivePhotoData(photoDataUrl);
        setShowFaceVerif(false);
        await runFaceSimilarityCheck(photoDataUrl);
    };

    const submitRegistration = async () => {
        // NEW: Validate ALL T&C acceptance with separate checks
        if (!formData.termsPaymentAccepted || !formData.termsDisputePolicyAccepted || 
            !formData.termsDataPrivacyAccepted || !formData.termsWorkerProtectionAccepted) {
            return toast.error('Please accept all terms and conditions.');
        }
        if (!faceMatchPassed) return toast.error('Face similarity is below threshold. Registration is blocked.');
        if (!livePhotoData) return toast.error('Please complete face verification first.');

        const data = new FormData();
        const normalizedForm = {
            ...formData,
            ageVerified: Number(formData.age) >= 18,
        };
        Object.keys(normalizedForm).forEach(k => data.append(k, normalizedForm[k]));
        // NEW: Add all new files
        if (files.photo) data.append('photo', files.photo);
        if (files.idProof) data.append('idProof', files.idProof);
        if (files.proofOfResidence) data.append('proofOfResidence', files.proofOfResidence);
        if (files.secondaryIdProof) data.append('secondaryIdProof', files.secondaryIdProof);
        if (files.professionalCertification) data.append('professionalCertification', files.professionalCertification);

        // Attach live face photo
        const blob = dataURLtoBlob(livePhotoData);
        data.append('livePhoto', blob, 'live_face.jpg');

        const id = toast.loading('Creating your account…');
        try {
            await api.registerClient(data);
            toast.success('Account created successfully! 🎉', { id });
            navigate('/login');
        } catch (err) {
            const msg = err.response?.data?.message || 'Registration failed';
            const isDuplicate = err.response?.data?.duplicateFace;
            toast.error(isDuplicate
                ? '⚠️ A KarigarConnect account already exists for this face. Duplicate registrations are not allowed.'
                : msg,
            { id, duration: isDuplicate ? 6000 : 4000 });
            setLivePhotoData(null);
        }
    };

    const sections = [
        {
            title: 'Basic Info',
            icon: User,
            completed: !!formData.name && !!formData.age && Number(formData.age) >= 18 && !!formData.dob && !!formData.gender && mobileVerified && emailVerified,
        },
        {
            title: 'Address Details',
            icon: MapPin,
            completed: !!formData.fullAddress && !!formData.city && !!formData.village && !!formData.pincode && !!formData.latitude && !!formData.longitude,
        },
        {
            title: 'Profile & Identity',
            icon: FileText,
            completed: !!files.photo && !!files.idProof,
        },
        {
            title: 'Optional',
            icon: Briefcase,
            completed: true,
        },
        {
            title: 'Set Password',
            icon: Shield,
            completed: !!formData.password && formData.password === formData.confirmPassword && isStrongPassword(formData.password),
        },
        {
            title: 'Face Verification',
            icon: Camera,
            completed: !!livePhotoData && faceMatchPassed,
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-8 px-4">
            <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-orange-200">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="relative">
                        <Link to="/register" className="inline-flex items-center text-white/90 hover:text-white mb-4">
                            <ArrowLeft className="h-5 w-5 mr-2" />Back
                        </Link>
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mr-4 backdrop-blur-sm">
                                <User className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold mb-2">Create Client Account</h1>
                                <p className="text-orange-100 text-lg">Find trusted, verified professionals near you</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 border-b border-orange-200">
                    <div className="flex items-center justify-start sm:justify-center gap-3 overflow-x-auto pb-2">
                        {sections.map((s, i) => {
                            const isActive = activeSection === i;
                            const isDone = s.completed && !isActive;
                            return (
                                <React.Fragment key={s.title}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection(i)}
                                        className="flex items-center gap-2 focus:outline-none"
                                    >
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                                                isDone
                                                    ? 'bg-green-500 text-white'
                                                    : isActive
                                                    ? 'bg-orange-500 text-white shadow-lg scale-110'
                                                    : 'bg-white text-orange-500 border-2 border-orange-200'
                                            }`}
                                        >
                                            {isDone ? <CheckCircle className="h-4 w-4" /> : i + 1}
                                        </div>
                                        <span className={`text-xs font-semibold whitespace-nowrap ${isActive ? 'text-orange-700' : isDone ? 'text-green-700' : 'text-gray-500'}`}>
                                            {s.title}
                                        </span>
                                    </button>
                                    {i < sections.length - 1 && (
                                        <div className={`h-0.5 w-8 sm:w-12 ${activeSection > i ? 'bg-green-400' : 'bg-orange-200'}`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                <div className="p-8">
                    <form className="space-y-8">
                        {activeSection === 0 && (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center">
                                        <User className="h-8 w-8 mr-3" />Basic Information
                                    </h2>
                                    <p className="text-gray-600 mt-2">Add details and verify your contact information</p>
                                </div>

                                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 space-y-5">
                                    <input
                                        name="name"
                                        value={formData.name}
                                        placeholder="Name as per Aadhar"
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 placeholder-orange-400 focus:ring-2 focus:ring-orange-500"
                                    />

                                    <div>
                                        <label className="block text-sm font-medium text-orange-800 mb-1">Mobile Number</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                name="mobile"
                                                value={formData.mobile}
                                                placeholder="10-digit Mobile"
                                                onChange={handleChange}
                                                disabled={mobileVerified}
                                                className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSendMobileOtp}
                                                disabled={mobileOtpSent || mobileVerified}
                                                className="px-4 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:bg-orange-300 whitespace-nowrap"
                                            >
                                                Send OTP
                                            </button>
                                        </div>
                                        {mobileOtpSent && !mobileVerified && (
                                            <div className="flex items-center space-x-2 mt-3">
                                                <input
                                                    placeholder="Enter Mobile OTP"
                                                    value={mobileOtp}
                                                    onChange={e => setMobileOtp(e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                                                />
                                                <button type="button" onClick={handleVerifyMobileOtp} className="px-4 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700">Verify</button>
                                            </div>
                                        )}
                                        {mobileVerified && <p className="text-green-600 font-semibold mt-2">Mobile verified</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-orange-800 mb-1">Email Address</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                placeholder="your.email@example.com"
                                                onChange={handleChange}
                                                disabled={emailVerified}
                                                className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSendEmailOtp}
                                                disabled={emailOtpSent || emailVerified}
                                                className="px-4 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:bg-orange-300 whitespace-nowrap"
                                            >
                                                Send OTP
                                            </button>
                                        </div>
                                        {emailOtpSent && !emailVerified && (
                                            <div className="flex items-center space-x-2 mt-3">
                                                <input
                                                    placeholder="Enter Email OTP"
                                                    value={emailOtp}
                                                    onChange={e => setEmailOtp(e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                                                />
                                                <button type="button" onClick={handleVerifyEmailOtp} className="px-4 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700">Verify</button>
                                            </div>
                                        )}
                                        {emailVerified && <p className="text-green-600 font-semibold mt-2">Email verified</p>}
                                    </div>

                                    {/* Age, Birth date and Gender */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input
                                            type="number"
                                            name="age"
                                            min="18"
                                            step="1"
                                            value={formData.age}
                                            placeholder="Age (18+)"
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        />
                                        <input
                                            type="date"
                                            name="dob"
                                            value={formData.dob}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        />
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>

                                    {/* NEW: Emergency Contact */}
                                    <div className="border-2 border-orange-200 rounded-lg p-4 bg-white">
                                        <p className="font-semibold text-orange-800 mb-3">Emergency Contact <span className="text-red-600">*</span></p>
                                        <div className="space-y-3">
                                            <input
                                                name="emergencyContactName"
                                                value={formData.emergencyContactName}
                                                placeholder="Emergency Contact Name"
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                            />
                                            <input
                                                name="emergencyContactMobile"
                                                value={formData.emergencyContactMobile}
                                                placeholder="Emergency Contact Mobile (10-digit)"
                                                onChange={handleChange}
                                                inputMode="numeric"
                                                className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button type="button" onClick={goToAddressSection} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl">
                                        Next: Address Details
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeSection === 1 && (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><MapPin className="h-8 w-8 mr-3" />Address Details</h2>
                                </div>

                                <div className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50">
                                    <button
                                        type="button"
                                        onClick={captureLocation}
                                        className="mb-4 px-5 py-3 bg-orange-100 text-orange-700 font-semibold rounded-xl hover:bg-orange-200 border border-orange-300"
                                    >
                                        Use Live Location
                                    </button>
                                    {locationError && <p className="text-sm text-red-600 mb-3">{locationError}</p>}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input name="fullAddress" value={formData.fullAddress} placeholder="Full Address" onChange={handleChange} className="md:col-span-2 px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                        <input name="homeLocation" value={formData.homeLocation} placeholder="Home Location / Area" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                        <input name="houseNumber" value={formData.houseNumber} placeholder="House No. (Optional)" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                        <input name="city" value={formData.city} placeholder="City" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                        <input name="village" value={formData.village} placeholder="Village" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                        <input name="locality" value={formData.locality} placeholder="Locality (optional)" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                        <input name="pincode" value={formData.pincode} placeholder="Pincode" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                        <input name="latitude" value={formData.latitude} placeholder="Latitude" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                        <input name="longitude" value={formData.longitude} placeholder="Longitude" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <button type="button" onClick={() => setActiveSection(0)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl">Back</button>
                                    <button type="button" onClick={goToProfileSection} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl">Next: Profile & Identity</button>
                                </div>
                            </div>
                        )}

                        {activeSection === 2 && (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><FileText className="h-8 w-8 mr-3" />Profile & Identity</h2>
                                </div>

                                <div className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-orange-800 mb-1">Profile Photo</label>
                                            <input type="file" name="photo" accept="image/*" onChange={handleFileChange} className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-orange-800 mb-1">ID Proof Type</label>
                                            <select name="idType" value={formData.idType} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500">
                                                <option value="Aadhar">Aadhar Card</option>
                                                <option value="Pan">PAN Card</option>
                                                <option value="Voter ID">Voter ID</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-orange-800 mb-1">Upload ID Proof</label>
                                            <input type="file" name="idProof" onChange={handleFileChange} className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <button type="button" onClick={() => setActiveSection(1)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl">Back</button>
                                    <button type="button" onClick={goToOptionalSection} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl">Next: Optional</button>
                                </div>
                            </div>
                        )}

                        {activeSection === 3 && (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><Briefcase className="h-8 w-8 mr-3" />Additional Information & Security</h2>
                                    <p className="text-gray-600 mt-2">Help us verify your profile and prevent fraud</p>
                                </div>

                                <div className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50 space-y-4">
                                    {/* Profession & Intent */}
                                    <div>
                                        <label className="block text-sm font-semibold text-orange-800 mb-2">Profession / Occupation</label>
                                        <input
                                            name="profession"
                                            value={formData.profession}
                                            placeholder="e.g., Homeowner, Contractor, Business Owner"
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-orange-800 mb-2">Reason for Signup</label>
                                        <select
                                            name="signupReason"
                                            value={formData.signupReason}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        >
                                            <option value="">-- Select --</option>
                                            <option value="Home Service">Home Service</option>
                                            <option value="Event">Event</option>
                                            <option value="Business Project">Business Project</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-orange-800 mb-2">Have you hired workers before?</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="previousHiringExperience"
                                                    value="true"
                                                    checked={formData.previousHiringExperience === true}
                                                    onChange={() => setFormData({ ...formData, previousHiringExperience: true })}
                                                    className="h-4 w-4"
                                                />
                                                <span className="text-sm text-gray-700">Yes</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="previousHiringExperience"
                                                    value="false"
                                                    checked={formData.previousHiringExperience === false}
                                                    onChange={() => setFormData({ ...formData, previousHiringExperience: false })}
                                                    className="h-4 w-4"
                                                />
                                                <span className="text-sm text-gray-700">No</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-orange-800 mb-2">Preferred Payment Method</label>
                                        <select
                                            name="preferredPaymentMethod"
                                            value={formData.preferredPaymentMethod}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        >
                                            <option value="">-- Select --</option>
                                            <option value="UPI">UPI</option>
                                            <option value="Card">Card</option>
                                            <option value="Bank">Bank Transfer</option>
                                            <option value="Wallet">Digital Wallet</option>
                                        </select>
                                    </div>

                                    {/* Security Question */}
                                    <div>
                                        <label className="block text-sm font-semibold text-orange-800 mb-2">Security Question (For account recovery)</label>
                                        <input
                                            name="securityQuestion"
                                            value={formData.securityQuestion}
                                            placeholder="e.g., What is your pet's name?"
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-orange-800 mb-2">Answer</label>
                                        <input
                                            name="securityAnswer"
                                            value={formData.securityAnswer}
                                            placeholder="Answer to your security question"
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>

                                    {/* Proof of Residence */}
                                    <div className="border-t pt-4">
                                        <label className="block text-sm font-semibold text-orange-800 mb-2">Proof of Residence (Optional)</label>
                                        <p className="text-xs text-gray-600 mb-2">Upload utility bill, lease, or bank statement</p>
                                        <input
                                            type="file"
                                            name="proofOfResidence"
                                            onChange={handleFileChange}
                                            accept="image/*,application/pdf"
                                            className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 file:bg-orange-100 file:text-orange-700 file:border-0 file:rounded file:px-3 file:py-1"
                                        />
                                        {files.proofOfResidence && <p className="text-xs text-green-600 mt-1">✓ {files.proofOfResidence.name}</p>}
                                    </div>

                                    {/* Legacy fields */}
                                    <div className="border-t pt-4 space-y-3">
                                        <input
                                            name="workplaceInfo"
                                            value={formData.workplaceInfo}
                                            placeholder="Workplace Info (Optional)"
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        />
                                        <input
                                            name="socialProfile"
                                            value={formData.socialProfile}
                                            placeholder="LinkedIn / Facebook URL (Optional)"
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <button type="button" onClick={() => setActiveSection(2)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl">Back</button>
                                    <button type="button" onClick={goToPasswordSection} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl">Next: Set Password</button>
                                </div>
                            </div>
                        )}

                        {activeSection === 4 && (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><Shield className="h-8 w-8 mr-3" />Set Password</h2>
                                </div>

                                <div className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="relative">
                                            <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} placeholder="Create Password" onChange={handleChange} className="w-full px-4 py-3 pr-12 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                        </div>
                                        <div className="relative">
                                            <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} placeholder="Confirm Password" onChange={handleChange} className="w-full px-4 py-3 pr-12 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500" />
                                            <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: strength.width }} />
                                        </div>
                                        <p className={`text-xs mt-1 ${strength.text}`}>Strength: {strength.label}</p>
                                        <p className="text-xs text-gray-500">{PASSWORD_POLICY_TEXT}</p>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <button type="button" onClick={() => setActiveSection(3)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl">Back</button>
                                    <button type="button" onClick={goToFaceSection} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl">Next: Face Verification</button>
                                </div>
                            </div>
                        )}

                        {activeSection === 5 && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><Camera className="h-8 w-8 mr-3" />Face Verification</h2>
                                    <p className="text-gray-600 mt-2">We compare your live face with your uploaded ID proof before account creation.</p>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                                    <p className="font-bold text-blue-800 mb-3">How it works</p>
                                    <div className="space-y-2 text-sm text-blue-700">
                                        <p>1. ID face and live face are compared securely.</p>
                                        <p>2. Liveness checks ensure you are physically present.</p>
                                        <p>3. Registration continues only if similarity passes threshold.</p>
                                        <p>4. Face data is used only for identity and fraud prevention.</p>
                                    </div>
                                </div>

                                {livePhotoData ? (
                                    <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
                                        <div className="text-5xl mb-3">OK</div>
                                        <p className="text-xl font-bold text-green-800">Face Verification Complete</p>
                                        <p className="text-green-600 mt-1 text-sm">Liveness detected and photo captured</p>
                                        <div className="mt-4">
                                            <img src={livePhotoData} alt="Captured face" className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-green-400 shadow-lg" />
                                        </div>

                                        <div className="mt-4 bg-white border border-green-200 rounded-xl p-3 text-left max-w-md mx-auto">
                                            {checkingSimilarity ? (
                                                <p className="text-sm text-orange-700 font-medium">Checking similarity with ID proof...</p>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-gray-700">Similarity Score: <span className="font-bold">{typeof similarity === 'number' ? similarity.toFixed(3) : 'N/A'}</span></p>
                                                    <p className="text-sm text-gray-700">Threshold: <span className="font-bold">{similarityThreshold.toFixed(2)}</span></p>
                                                    <p className={`text-sm mt-1 font-semibold ${faceMatchPassed ? 'text-green-700' : 'text-red-700'}`}>
                                                        {faceMessage || (faceMatchPassed ? 'Face match passed.' : 'Face match failed. Please retry.')}
                                                    </p>
                                                </>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLivePhotoData(null);
                                                setFaceMatchPassed(false);
                                                setFaceMessage('');
                                                setSimilarity(null);
                                            }}
                                            className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
                                        >
                                            Redo verification
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 text-center">
                                        <Camera className="h-16 w-16 text-orange-400 mx-auto mb-4" />
                                        <p className="font-bold text-gray-800 text-lg mb-2">Start Face Verification</p>
                                        <p className="text-sm text-gray-500 mb-5">Keep your face clearly visible in good lighting.</p>
                                        <button
                                            type="button"
                                            onClick={startFaceVerification}
                                            className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-2xl shadow-lg hover:from-orange-600 hover:to-amber-600 transition-all text-base"
                                        >
                                            Start Camera Verification
                                        </button>
                                    </div>
                                )}

                                <div className="bg-white border border-orange-200 rounded-2xl p-5">
                                    <p className="font-bold text-orange-800 mb-3">Registration Summary</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                        <p><span className="font-semibold">Name:</span> {formData.name || 'N/A'}</p>
                                        <p><span className="font-semibold">Age:</span> {formData.age || 'N/A'}</p>
                                        <p><span className="font-semibold">Birth Date:</span> {formData.dob || 'N/A'}</p>
                                        <p><span className="font-semibold">Gender:</span> {formData.gender || 'N/A'}</p>
                                        <p><span className="font-semibold">Mobile:</span> {formData.mobile || 'N/A'}</p>
                                        <p><span className="font-semibold">Email:</span> {formData.email || 'N/A'}</p>
                                        <p><span className="font-semibold">City:</span> {formData.city || 'N/A'}</p>
                                        <p><span className="font-semibold">Village:</span> {formData.village || 'N/A'}</p>
                                        <p><span className="font-semibold">Pincode:</span> {formData.pincode || 'N/A'}</p>
                                        <p><span className="font-semibold">Latitude:</span> {formData.latitude || 'N/A'}</p>
                                        <p><span className="font-semibold">Longitude:</span> {formData.longitude || 'N/A'}</p>
                                        <p><span className="font-semibold">ID Proof:</span> {files.idProof?.name || 'Not selected'}</p>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-orange-200 space-y-3">
                                    <p className="font-semibold text-orange-800 mb-3">Accept All Terms & Conditions <span className="text-red-600">*</span></p>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.termsPaymentAccepted}
                                            onChange={e => setFormData({ ...formData, termsPaymentAccepted: e.target.checked })}
                                            className="h-5 w-5 mt-0.5 rounded border-orange-300 text-orange-600"
                                        />
                                        <span className="text-sm text-gray-700">I agree to <button type="button" onClick={() => openLegalPreview('Payment Terms & Conditions', '/terms-and-conditions')} className="text-orange-600 underline font-bold">Payment Terms & Conditions</button></span>
                                    </label>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.termsDisputePolicyAccepted}
                                            onChange={e => setFormData({ ...formData, termsDisputePolicyAccepted: e.target.checked })}
                                            className="h-5 w-5 mt-0.5 rounded border-orange-300 text-orange-600"
                                        />
                                        <span className="text-sm text-gray-700">I agree to <button type="button" onClick={() => openLegalPreview('Dispute Resolution Policy', '/terms-and-conditions')} className="text-orange-600 underline font-bold">Dispute Resolution Policy</button></span>
                                    </label>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.termsDataPrivacyAccepted}
                                            onChange={e => setFormData({ ...formData, termsDataPrivacyAccepted: e.target.checked })}
                                            className="h-5 w-5 mt-0.5 rounded border-orange-300 text-orange-600"
                                        />
                                        <span className="text-sm text-gray-700">I agree to <button type="button" onClick={() => openLegalPreview('Data Privacy Policy', '/privacy-policy')} className="text-orange-600 underline font-bold">Data Privacy Policy</button></span>
                                    </label>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.termsWorkerProtectionAccepted}
                                            onChange={e => setFormData({ ...formData, termsWorkerProtectionAccepted: e.target.checked })}
                                            className="h-5 w-5 mt-0.5 rounded border-orange-300 text-orange-600"
                                        />
                                        <span className="text-sm text-gray-700">I agree to <button type="button" onClick={() => openLegalPreview('Worker Protection & Safety Terms', '/terms-and-conditions')} className="text-orange-600 underline font-bold">Worker Protection & Safety Terms</button></span>
                                    </label>
                                </div>

                                <div className="flex justify-between pt-4">
                                    <button type="button" onClick={() => setActiveSection(4)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl">Back</button>
                                    <button
                                        type="button"
                                        onClick={submitRegistration}
                                        disabled={!mobileVerified || !emailVerified || !livePhotoData || !faceMatchPassed || 
                                                 !formData.termsPaymentAccepted || !formData.termsDisputePolicyAccepted || 
                                                 !formData.termsDataPrivacyAccepted || !formData.termsWorkerProtectionAccepted || checkingSimilarity}
                                        className="px-12 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl disabled:from-gray-400 disabled:to-gray-500 shadow-xl text-lg"
                                    >
                                        Submit Registration
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>

                    <div className="mt-8 text-center border-t pt-6">
                        <Link to="/login" className="text-sm text-orange-600 hover:text-orange-800 font-medium hover:underline">Already have an account? Login</Link>
                    </div>
                </div>
            </div>

            {legalPreview.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={closeLegalPreview}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="h-14 border-b border-orange-100 px-4 sm:px-5 flex items-center justify-between bg-orange-50">
                            <h3 className="text-sm sm:text-base font-black text-orange-700 truncate">{legalPreview.title}</h3>
                            <button type="button" onClick={closeLegalPreview} className="w-9 h-9 rounded-full bg-white border border-orange-200 text-orange-700 hover:bg-orange-100 flex items-center justify-center" aria-label="Close legal preview">
                                <X size={18} />
                            </button>
                        </div>
                        <iframe title={legalPreview.title} src={legalPreview.path} className="w-full h-[calc(85vh-56px)] border-0 bg-white" />
                    </div>
                </div>
            )}

            {/* Face Verification Modal */}
            {showFaceVerif && (
                <FaceVerification
                    title="Client Identity Verification"
                    subtitle="We check for duplicate accounts and confirm you are a real person"
                    onComplete={handleFaceComplete}
                    onCancel={() => setShowFaceVerif(false)}
                />
            )}
        </div>
    );
};

export default ClientRegister;
