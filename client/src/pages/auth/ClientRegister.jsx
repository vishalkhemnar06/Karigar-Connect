// client/src/pages/auth/ClientRegister.jsx
// CHANGE: Face verification modal is shown when user clicks "Create Account".
// After liveness passes, the live photo is included in FormData.
// All other form fields are UNCHANGED.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import FaceVerification, { dataURLtoBlob } from './FaceVerification';
import { Eye, EyeOff } from 'lucide-react';
import { PASSWORD_POLICY_TEXT, getPasswordStrength, isStrongPassword } from '../../constants/passwordPolicy';

const ClientRegister = () => {
    const [formData, setFormData] = useState({
        name:'', mobile:'', email:'', password:'', confirmPassword:'',
        city:'', pincode:'', homeLocation:'', houseNumber:'',
        idType:'Aadhar', workplaceInfo:'', socialProfile:'',
    });
    const [files, setFiles] = useState({ photo:null, idProof:null });

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
    const [privacyConsent, setPrivacyConsent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const navigate = useNavigate();
    const strength = getPasswordStrength(formData.password);

    const handleChange     = e => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleFileChange = e => setFiles({ ...files, [e.target.name]: e.target.files[0] });

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

    // ── Validate form before opening face verification ────────────────────────
    const handleCreateAccount = e => {
        e.preventDefault();
        if (!mobileVerified || !emailVerified) return toast.error('Verify both mobile and email first.');
        if (formData.password !== formData.confirmPassword) return toast.error("Passwords don't match");
        if (!isStrongPassword(formData.password)) return toast.error(PASSWORD_POLICY_TEXT);
        if (!formData.city || !formData.homeLocation) return toast.error('Address details required');
        if (!files.idProof) return toast.error('Upload ID proof before face verification.');
        // Open face verification
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
        if (!privacyConsent) return toast.error('Please confirm privacy consent before submission.');
        if (!faceMatchPassed) return toast.error('Face similarity is below threshold. Registration is blocked.');
        if (!livePhotoData) return toast.error('Please complete face verification first.');

        const data = new FormData();
        Object.keys(formData).forEach(k => data.append(k, formData[k]));
        if (files.photo)   data.append('photo',   files.photo);
        if (files.idProof) data.append('idProof', files.idProof);

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center py-12 px-4">
            <div className="max-w-4xl w-full bg-white p-8 rounded-2xl shadow-xl border border-orange-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 py-6 px-8 -mx-8 -mt-8 rounded-t-2xl mb-8 text-center">
                    <h2 className="text-3xl font-bold text-white">Create a Client Account</h2>
                    <p className="text-orange-100 mt-2">Join KarigarConnect to find skilled professionals</p>
                </div>

                <form onSubmit={handleCreateAccount} className="space-y-6">

                    {/* Basic Info & Verification (UNCHANGED) */}
                    <fieldset className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50">
                        <legend className="px-3 font-bold text-orange-800 text-lg bg-white border-2 border-orange-200 rounded-lg">Basic Information & Verification</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <input name="name" placeholder="Name as per Aadhar" onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 placeholder-orange-400 focus:ring-2 focus:ring-orange-500"/>
                            </div>
                            {/* Mobile OTP */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-orange-800 mb-1">Mobile Number</label>
                                <div className="flex items-center space-x-2">
                                    <input name="mobile" placeholder="10-digit Mobile" onChange={handleChange} required disabled={mobileVerified} className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                                    <button type="button" onClick={handleSendMobileOtp} disabled={mobileOtpSent || mobileVerified} className="px-4 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:bg-orange-300 whitespace-nowrap">Send OTP</button>
                                </div>
                                {mobileOtpSent && !mobileVerified && (
                                    <div className="flex items-center space-x-2 mt-3">
                                        <input placeholder="Enter Mobile OTP" value={mobileOtp} onChange={e => setMobileOtp(e.target.value)} className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"/>
                                        <button type="button" onClick={handleVerifyMobileOtp} className="px-4 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700">Verify</button>
                                    </div>
                                )}
                                {mobileVerified && <p className="text-green-600 font-semibold mt-2">✓ Mobile Verified</p>}
                            </div>
                            {/* Email OTP */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-orange-800 mb-1">Email Address</label>
                                <div className="flex items-center space-x-2">
                                    <input type="email" name="email" placeholder="your.email@example.com" onChange={handleChange} required disabled={emailVerified} className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                                    <button type="button" onClick={handleSendEmailOtp} disabled={emailOtpSent || emailVerified} className="px-4 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:bg-orange-300 whitespace-nowrap">Send OTP</button>
                                </div>
                                {emailOtpSent && !emailVerified && (
                                    <div className="flex items-center space-x-2 mt-3">
                                        <input placeholder="Enter Email OTP" value={emailOtp} onChange={e => setEmailOtp(e.target.value)} className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"/>
                                        <button type="button" onClick={handleVerifyEmailOtp} className="px-4 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700">Verify</button>
                                    </div>
                                )}
                                {emailVerified && <p className="text-green-600 font-semibold mt-2">✓ Email Verified</p>}
                            </div>
                        </div>
                    </fieldset>

                    {/* Address (UNCHANGED) */}
                    <fieldset className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50">
                        <legend className="px-3 font-bold text-orange-800 text-lg bg-white border-2 border-orange-200 rounded-lg">Address Details</legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input name="homeLocation" placeholder="Home Location / Area" onChange={handleChange} required className="md:col-span-2 px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                            <input name="houseNumber" placeholder="House No. (Optional)" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                            <input name="city" placeholder="City" onChange={handleChange} required className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                            <input name="pincode" placeholder="Pincode" onChange={handleChange} required className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                        </div>
                    </fieldset>

                    {/* Profile & Identity (UNCHANGED) */}
                    <fieldset className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50">
                        <legend className="px-3 font-bold text-orange-800 text-lg bg-white border-2 border-orange-200 rounded-lg">Profile & Identity</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-orange-800 mb-1">Profile Photo</label>
                                <input type="file" name="photo" accept="image/*" onChange={handleFileChange} required className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-orange-800 mb-1">ID Proof Type</label>
                                <select name="idType" onChange={handleChange} className="w-full px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500">
                                    <option value="Aadhar">Aadhar Card</option><option value="Pan">PAN Card</option><option value="Voter ID">Voter ID</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-orange-800 mb-1">Upload ID Proof</label>
                                <input type="file" name="idProof" onChange={handleFileChange} required className="w-full px-4 py-2 bg-white border border-orange-300 rounded-lg text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"/>
                            </div>
                        </div>
                    </fieldset>

                    {/* Optional (UNCHANGED) */}
                    <fieldset className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50">
                        <legend className="px-3 font-bold text-orange-800 text-lg bg-white border-2 border-orange-200 rounded-lg">Optional Information</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="workplaceInfo" placeholder="Workplace / Profession (Optional)" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                            <input name="socialProfile" placeholder="LinkedIn / Facebook URL (Optional)" onChange={handleChange} className="px-4 py-3 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                        </div>
                    </fieldset>

                    {/* Password (UNCHANGED) */}
                    <fieldset className="border-2 border-orange-200 p-5 rounded-xl bg-orange-50">
                        <legend className="px-3 font-bold text-orange-800 text-lg bg-white border-2 border-orange-200 rounded-lg">Set Password</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} name="password" placeholder="Create Password" onChange={handleChange} required className="w-full px-4 py-3 pr-12 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
                                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                            </div>
                            <div className="relative">
                                <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} required className="w-full px-4 py-3 pr-12 bg-white border border-orange-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500"/>
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
                    </fieldset>

                    {/* Face verification info banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">🔐</span>
                            <div>
                                <p className="font-bold text-blue-800 text-sm">Face Verification Required</p>
                                <p className="text-xs text-blue-600 mt-0.5">Complete liveness and similarity check against your ID proof. Registration is allowed only when the similarity score passes threshold.</p>
                            </div>
                        </div>
                    </div>

                    {livePhotoData && (
                        <div className="bg-white border border-orange-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <img src={livePhotoData} alt="Live face" className="w-14 h-14 rounded-full object-cover border-2 border-orange-300" />
                                <div>
                                    <p className="font-semibold text-orange-700">Live Face Captured</p>
                                    <p className="text-xs text-gray-500">Similarity is checked against your ID proof</p>
                                </div>
                            </div>

                            <div className="text-sm text-gray-700">
                                <p>Similarity Score: <span className="font-bold">{typeof similarity === 'number' ? similarity.toFixed(3) : 'N/A'}</span></p>
                                <p>Threshold: <span className="font-bold">{similarityThreshold.toFixed(2)}</span></p>
                                <p className={`mt-1 font-semibold ${faceMatchPassed ? 'text-green-700' : 'text-red-700'}`}>
                                    {checkingSimilarity ? 'Checking similarity...' : (faceMessage || (faceMatchPassed ? 'Face match passed.' : 'Face match failed.'))}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setLivePhotoData(null);
                                    setFaceMatchPassed(false);
                                    setFaceMessage('');
                                    setSimilarity(null);
                                    setShowFaceVerif(true);
                                }}
                                className="text-sm text-orange-600 hover:text-orange-800 underline"
                            >
                                Re-verify face
                            </button>
                        </div>
                    )}

                    <label className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={privacyConsent}
                            onChange={(e) => setPrivacyConsent(e.target.checked)}
                            className="mt-1 h-4 w-4"
                        />
                        <span className="text-sm text-gray-700">
                            I confirm that I consent to face verification and secure processing of my personal data for identity protection and fraud prevention.
                        </span>
                    </label>

                    <button type="submit" disabled={!mobileVerified || !emailVerified}
                        className="w-full py-4 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-md hover:from-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2">
                        🔐 Verify Face
                    </button>

                    <button
                        type="button"
                        onClick={submitRegistration}
                        disabled={!mobileVerified || !emailVerified || !livePhotoData || !faceMatchPassed || !privacyConsent || checkingSimilarity}
                        className="w-full py-4 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-md hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300"
                    >
                        Submit Registration
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link to="/login" className="text-sm text-orange-600 hover:text-orange-800 font-medium hover:underline">Already have an account? Login</Link>
                </div>
            </div>

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
