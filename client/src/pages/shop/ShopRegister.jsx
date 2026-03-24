// client/src/pages/shop/ShopRegister.jsx
// FIXED: Input re-render bug resolved — all field components defined outside ShopRegister.
// IMPROVED: Professional 3-step design, proper file preview, image handling.

import React, { useState, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    Store, User, Phone, Mail, Lock, MapPin, FileText,
    CheckCircle, ChevronRight, ChevronLeft, Upload, Tag,
    Eye, EyeOff, Building2, Hash, Image as ImageIcon
} from 'lucide-react';

const SHOP_CATEGORIES = [
    'Electronics & Tools', 'Plumbing Supplies', 'Electrical Supplies',
    'Carpentry & Woodwork', 'Painting Supplies', 'Welding & Fabrication',
    'Masonry & Construction', 'Automobile Parts', 'Gardening & Landscaping',
    'Safety Equipment', 'Other',
];

const ID_TYPES = ['Aadhar Card', 'PAN Card', 'Voter ID', 'Driving Licence', 'Passport'];

// ── Stable field components (OUTSIDE ShopRegister) ───────────────────────────

const Field = memo(({ label, required, hint, error, children }) => (
    <div className="space-y-1.5">
        {label && (
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">
                {label}{required && <span className="text-red-400 ml-1">*</span>}
            </label>
        )}
        {children}
        {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
));
Field.displayName = 'Field';

const Input = memo(({ type = 'text', placeholder, value, onChange, disabled,
    required, maxLength, prefix, rightSlot, error }) => (
    <div className="relative flex items-center">
        {prefix && (
            <span className="absolute left-4 text-gray-400 text-sm font-medium select-none pointer-events-none z-10">
                {prefix}
            </span>
        )}
        <input
            type={type} placeholder={placeholder} value={value} onChange={onChange}
            disabled={disabled} required={required} maxLength={maxLength}
            className={[
                'w-full border-2 rounded-xl py-3 bg-white text-gray-900 text-sm',
                'placeholder-gray-300 transition-all duration-200',
                'focus:outline-none focus:ring-4 focus:ring-orange-50',
                prefix ? 'pl-14' : 'pl-4',
                rightSlot ? 'pr-12' : 'pr-4',
                disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : '',
                error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-orange-400',
            ].join(' ')}
        />
        {rightSlot && <div className="absolute right-3 z-10">{rightSlot}</div>}
    </div>
));
Input.displayName = 'Input';

const Select = memo(({ value, onChange, options, placeholder, error }) => (
    <div className="relative">
        <select value={value} onChange={onChange}
            className={[
                'w-full border-2 rounded-xl py-3 pl-4 pr-10 bg-white text-sm text-gray-900 appearance-none',
                'focus:outline-none focus:ring-4 focus:ring-orange-50 transition-all duration-200',
                error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-orange-400',
            ].join(' ')}>
            <option value="">{placeholder || '-- Select --'}</option>
            {options.map(o => <option key={o}>{o}</option>)}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
));
Select.displayName = 'Select';

const FileField = memo(({ label, value, onChange, accept, hint, preview }) => (
    <div className="space-y-1.5">
        <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
        <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-3 hover:border-orange-300 hover:bg-orange-50/50 transition-all">
            {preview
                ? <img src={preview} className="w-12 h-12 rounded-lg object-cover border" alt="preview" />
                : <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                    <Upload size={18} className="text-orange-400" />
                  </div>
            }
            <div>
                <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                    {value ? value.name : 'Click to upload'}
                </p>
                {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
            </div>
            <input type="file" accept={accept || 'image/*,.pdf'} className="hidden" onChange={onChange} />
        </label>
    </div>
));
FileField.displayName = 'FileField';

const OtpRow = memo(({ label, verified, value, onChange, otp, onOtpChange,
    onSend, onVerify, otpSent, loading, disabled }) => (
    <div className="space-y-2">
        <Field label={label}>
            <div className="flex gap-2">
                <div className="flex-1">
                    <Input placeholder={`Enter ${label.toLowerCase()}`}
                        value={value} onChange={onChange} disabled={disabled || verified} />
                </div>
                {!verified && (
                    <button type="button" onClick={onSend} disabled={loading || disabled}
                        className="shrink-0 px-4 py-3 bg-orange-100 hover:bg-orange-200 text-orange-700
                            rounded-xl text-xs font-black border border-orange-200 disabled:opacity-40 whitespace-nowrap transition-all">
                        {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                )}
                {verified && (
                    <div className="shrink-0 px-3 py-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-green-500" />
                        <span className="text-xs font-black text-green-600">Verified</span>
                    </div>
                )}
            </div>
        </Field>
        {otpSent && !verified && (
            <div className="flex gap-2">
                <Input placeholder="Enter OTP" value={otp} onChange={onOtpChange} maxLength={6} type="text" />
                <button type="button" onClick={onVerify} disabled={loading}
                    className="shrink-0 px-4 py-3 bg-green-500 hover:bg-green-600 text-white
                        rounded-xl text-xs font-black disabled:opacity-50 whitespace-nowrap transition-all">
                    Verify
                </button>
            </div>
        )}
    </div>
));
OtpRow.displayName = 'OtpRow';

// ── STEP INDICATOR ────────────────────────────────────────────────────────────
const StepDot = memo(({ n, current, label }) => (
    <div className="flex items-center gap-2">
        <div className={[
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all',
            n < current ? 'bg-green-500 text-white' :
            n === current ? 'bg-orange-500 text-white shadow-lg scale-110' :
            'bg-gray-100 text-gray-400',
        ].join(' ')}>
            {n < current ? <CheckCircle size={16} /> : n}
        </div>
        <span className={`text-xs font-semibold hidden sm:block ${n === current ? 'text-orange-600' : 'text-gray-400'}`}>
            {label}
        </span>
    </div>
));
StepDot.displayName = 'StepDot';

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const ShopRegister = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Contact verification state
    const [mobile, setMobile]             = useState('');
    const [mobileOtp, setMobileOtp]       = useState('');
    const [mobileOtpSent, setMobileOtpSent] = useState(false);
    const [mobileVerified, setMobileVerified] = useState(false);
    const [email, setEmail]               = useState('');
    const [emailOtp, setEmailOtp]         = useState('');
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [password, setPassword]         = useState('');
    const [confirmPwd, setConfirmPwd]     = useState('');
    const [showPwd, setShowPwd]           = useState(false);

    // Shop details state
    const [ownerName, setOwnerName]       = useState('');
    const [shopName, setShopName]         = useState('');
    const [gstNumber, setGstNumber]       = useState('');
    const [category, setCategory]         = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [address, setAddress]           = useState('');
    const [city, setCity]                 = useState('');
    const [pincode, setPincode]           = useState('');
    const [locality, setLocality]         = useState('');

    // Documents state
    const [idType, setIdType]             = useState('Aadhar Card');
    const [ownerPhoto, setOwnerPhoto]     = useState(null);
    const [idProof, setIdProof]           = useState(null);
    const [shopLogo, setShopLogo]         = useState(null);
    const [ownerPhotoPreview, setOwnerPhotoPreview] = useState(null);
    const [shopLogoPreview, setShopLogoPreview]     = useState(null);

    // Stable onChange handlers (no remount)
    const onMobile = useCallback(e => setMobile(e.target.value), []);
    const onMobileOtp = useCallback(e => setMobileOtp(e.target.value), []);
    const onEmail = useCallback(e => setEmail(e.target.value), []);
    const onEmailOtp = useCallback(e => setEmailOtp(e.target.value), []);
    const onPassword = useCallback(e => setPassword(e.target.value), []);
    const onConfirmPwd = useCallback(e => setConfirmPwd(e.target.value), []);
    const onOwnerName = useCallback(e => setOwnerName(e.target.value), []);
    const onShopName = useCallback(e => setShopName(e.target.value), []);
    const onGst = useCallback(e => setGstNumber(e.target.value), []);
    const onCategory = useCallback(e => setCategory(e.target.value), []);
    const onCustomCat = useCallback(e => setCustomCategory(e.target.value), []);
    const onAddress = useCallback(e => setAddress(e.target.value), []);
    const onCity = useCallback(e => setCity(e.target.value), []);
    const onPincode = useCallback(e => setPincode(e.target.value), []);
    const onLocality = useCallback(e => setLocality(e.target.value), []);
    const onIdType = useCallback(e => setIdType(e.target.value), []);

    const onOwnerPhoto = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setOwnerPhoto(f);
        setOwnerPhotoPreview(URL.createObjectURL(f));
    }, []);

    const onShopLogo = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setShopLogo(f);
        setShopLogoPreview(URL.createObjectURL(f));
    }, []);

    const onIdProof = useCallback(e => {
        const f = e.target.files[0];
        if (f) setIdProof(f);
    }, []);

    const togglePwd = useCallback(() => setShowPwd(v => !v), []);

    // OTP actions
    const sendMobileOtp = useCallback(async () => {
        if (!mobile || mobile.length !== 10) return toast.error('Enter valid 10-digit mobile.');
        setLoading(true);
        try {
            await api.shopSendMobileOtp({ mobile });
            setMobileOtpSent(true);
            toast.success('OTP sent to mobile!');
        } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); }
        finally { setLoading(false); }
    }, [mobile]);

    const verifyMobileOtp = useCallback(async () => {
        setLoading(true);
        try {
            await api.shopVerifyMobileOtp({ mobile, otp: mobileOtp });
            setMobileVerified(true);
            toast.success('Mobile verified!');
        } catch (e) { toast.error(e.response?.data?.message || 'Incorrect OTP.'); }
        finally { setLoading(false); }
    }, [mobile, mobileOtp]);

    const sendEmailOtp = useCallback(async () => {
        if (!email) return toast.error('Enter email first.');
        if (!mobileVerified) return toast.error('Verify mobile first.');
        setLoading(true);
        try {
            await api.shopSendEmailOtp({ email, mobile });
            setEmailOtpSent(true);
            toast.success('OTP sent to email!');
        } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); }
        finally { setLoading(false); }
    }, [email, mobile, mobileVerified]);

    const verifyEmailOtp = useCallback(async () => {
        setLoading(true);
        try {
            await api.shopVerifyEmailOtp({ mobile, otp: emailOtp });
            setEmailVerified(true);
            toast.success('Email verified!');
        } catch (e) { toast.error(e.response?.data?.message || 'Incorrect OTP.'); }
        finally { setLoading(false); }
    }, [mobile, emailOtp]);

    const goStep2 = useCallback(() => {
        if (!mobileVerified) return toast.error('Verify mobile number.');
        if (!emailVerified) return toast.error('Verify email address.');
        if (!password || password.length < 6) return toast.error('Password must be 6+ characters.');
        if (password !== confirmPwd) return toast.error('Passwords do not match.');
        setStep(2);
    }, [mobileVerified, emailVerified, password, confirmPwd]);

    const goStep3 = useCallback(() => {
        if (!ownerName || !shopName || !address || !city) return toast.error('Fill all required fields.');
        if (!category) return toast.error('Select shop category.');
        if (category === 'Other' && !customCategory) return toast.error('Enter custom category.');
        setStep(3);
    }, [ownerName, shopName, address, city, category, customCategory]);

    const handleSubmit = useCallback(async () => {
        setLoading(true);
        try {
            const fd = new FormData();
            const finalCat = category === 'Other' ? customCategory : category;
            const fields = { ownerName, mobile, email, password, shopName, gstNumber,
                             address, city, pincode, locality, idType, category: finalCat };
            Object.entries(fields).forEach(([k, v]) => fd.append(k, v || ''));
            if (ownerPhoto) fd.append('ownerPhoto', ownerPhoto);
            if (idProof)    fd.append('idProof', idProof);
            if (shopLogo)   fd.append('shopLogo', shopLogo);

            await api.shopRegister(fd);
            setSubmitted(true);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Registration failed.');
        } finally { setLoading(false); }
    }, [ownerName, mobile, email, password, shopName, gstNumber, address, city,
        pincode, locality, idType, category, customCategory, ownerPhoto, idProof, shopLogo]);

    // ── SUCCESS SCREEN ──────────────────────────────────────────────────────
    if (submitted) return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center border border-green-100">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle size={48} className="text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Registration Submitted!</h2>
                <p className="text-gray-500 mb-1">Your shop <span className="font-bold text-gray-800">"{shopName}"</span> has been submitted for review.</p>
                <p className="text-orange-600 font-bold text-sm mb-8 bg-orange-50 rounded-xl p-3">
                    ⏰ We will contact you within 24 hours.
                </p>
                <Link to="/login"
                    className="block w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3.5 rounded-xl font-black hover:shadow-lg transition-all">
                    Back to Login
                </Link>
            </div>
        </div>
    );

    const STEPS = ['Verify Contact', 'Shop Details', 'Documents'];

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl">
                {/* Header */}
                <div className="text-center mb-7">
                    <div className="inline-flex items-center gap-2 bg-orange-100 px-4 py-2 rounded-full mb-3">
                        <Store size={18} className="text-orange-600" />
                        <span className="font-black text-orange-700 text-sm uppercase tracking-wide">Shop Registration</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900">Register Your Shop</h1>
                    <p className="text-gray-500 text-sm mt-1.5">Join KarigarConnect & serve verified workers</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-3 mb-7">
                    {STEPS.map((label, i) => (
                        <React.Fragment key={i}>
                            <StepDot n={i + 1} current={step} label={label} />
                            {i < STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 max-w-[60px] ${step > i + 1 ? 'bg-green-400' : 'bg-gray-200'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Step header */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
                        <h2 className="text-white font-black text-lg">Step {step}: {STEPS[step - 1]}</h2>
                        <p className="text-orange-100 text-xs mt-0.5">
                            {step === 1 ? 'Verify your mobile and email before proceeding' :
                             step === 2 ? 'Tell us about your shop and location' :
                             'Upload required documents to complete registration'}
                        </p>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* ── STEP 1 ── */}
                        {step === 1 && (
                            <>
                                <OtpRow label="Mobile Number"
                                    value={mobile} onChange={onMobile}
                                    otp={mobileOtp} onOtpChange={onMobileOtp}
                                    onSend={sendMobileOtp} onVerify={verifyMobileOtp}
                                    otpSent={mobileOtpSent} verified={mobileVerified}
                                    loading={loading} />

                                <OtpRow label="Email Address"
                                    value={email} onChange={onEmail}
                                    otp={emailOtp} onOtpChange={onEmailOtp}
                                    onSend={sendEmailOtp} onVerify={verifyEmailOtp}
                                    otpSent={emailOtpSent} verified={emailVerified}
                                    loading={loading} disabled={!mobileVerified} />

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Password" required>
                                        <Input type={showPwd ? 'text' : 'password'}
                                            placeholder="Min 6 characters"
                                            value={password} onChange={onPassword} required
                                            rightSlot={
                                                <button type="button" onClick={togglePwd}
                                                    className="text-gray-400 hover:text-gray-600 p-1">
                                                    {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                </button>
                                            } />
                                    </Field>
                                    <Field label="Confirm Password" required>
                                        <Input type="password" placeholder="Re-enter"
                                            value={confirmPwd} onChange={onConfirmPwd} required />
                                    </Field>
                                </div>

                                <button onClick={goStep2}
                                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 hover:shadow-lg transition-all">
                                    Continue <ChevronRight size={18} />
                                </button>
                            </>
                        )}

                        {/* ── STEP 2 ── */}
                        {step === 2 && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Owner Name" required>
                                        <Input placeholder="Full name" value={ownerName} onChange={onOwnerName} required />
                                    </Field>
                                    <Field label="Shop Name" required>
                                        <Input placeholder="Shop name" value={shopName} onChange={onShopName} required />
                                    </Field>
                                </div>

                                <Field label="GST Number">
                                    <Input placeholder="Optional" value={gstNumber} onChange={onGst} />
                                </Field>

                                <Field label="Shop Category" required>
                                    <Select value={category} onChange={onCategory}
                                        options={SHOP_CATEGORIES} placeholder="-- Select Category --" />
                                </Field>

                                {category === 'Other' && (
                                    <Field label="Custom Category" required>
                                        <Input placeholder="Enter your category"
                                            value={customCategory} onChange={onCustomCat} required />
                                    </Field>
                                )}

                                <Field label="Full Address" required>
                                    <Input placeholder="Street / Building / Area"
                                        value={address} onChange={onAddress} required />
                                </Field>

                                <div className="grid grid-cols-3 gap-3">
                                    <Field label="City" required>
                                        <Input placeholder="City" value={city} onChange={onCity} required />
                                    </Field>
                                    <Field label="Pincode">
                                        <Input placeholder="Pincode" value={pincode} onChange={onPincode} maxLength={6} />
                                    </Field>
                                    <Field label="Locality">
                                        <Input placeholder="Area" value={locality} onChange={onLocality} />
                                    </Field>
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep(1)}
                                        className="flex-1 border-2 border-orange-200 text-orange-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-50 transition-all">
                                        <ChevronLeft size={18} /> Back
                                    </button>
                                    <button onClick={goStep3}
                                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all">
                                        Continue <ChevronRight size={18} />
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ── STEP 3 ── */}
                        {step === 3 && (
                            <>
                                <FileField label="Owner Profile Photo"
                                    value={ownerPhoto} onChange={onOwnerPhoto}
                                    accept="image/*" preview={ownerPhotoPreview}
                                    hint="JPG, PNG up to 5MB" />

                                <Field label="ID Proof Type" required>
                                    <Select value={idType} onChange={onIdType} options={ID_TYPES} />
                                </Field>

                                <FileField label="ID Proof Document"
                                    value={idProof} onChange={onIdProof}
                                    accept="image/*,.pdf"
                                    hint="Upload clear photo or scanned PDF" />

                                <FileField label="Shop Logo (optional)"
                                    value={shopLogo} onChange={onShopLogo}
                                    accept="image/*" preview={shopLogoPreview}
                                    hint="Square image recommended" />

                                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-xs text-orange-700 leading-relaxed">
                                    By submitting, you confirm that all information is accurate. Admin will review within 24 hours. You'll be notified via SMS once approved.
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep(2)}
                                        className="flex-1 border-2 border-orange-200 text-orange-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-50 transition-all">
                                        <ChevronLeft size={18} /> Back
                                    </button>
                                    <button onClick={handleSubmit} disabled={loading}
                                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50">
                                        {loading ? (
                                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                                        ) : 'Submit for Approval'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <p className="text-center text-sm text-gray-500 mt-5">
                    Already registered?{' '}
                    <Link to="/login" className="text-orange-600 font-bold hover:underline">Login here</Link>
                </p>
            </div>
        </div>
    );
};

export default ShopRegister;