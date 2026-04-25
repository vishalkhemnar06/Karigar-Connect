import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
    Shield, Key, Phone, Trash2, AlertTriangle, X, Eye, EyeOff, 
    Clock, CheckCircle2, Loader2, BookOpen, User, Mail, 
    Calendar, Award, TrendingUp, Star, Crown, Diamond, Sparkles,
    Settings as SettingsIcon, Bell, Globe, Lock, Smartphone,
    CreditCard, ShieldCheck, Zap, Gift, Heart, ThumbsUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import { PASSWORD_POLICY_TEXT, getPasswordStrength, isStrongPassword } from '../../constants/passwordPolicy';
import { useClientOnboarding } from '../../context/ClientOnboardingContext';

// ── Enhanced Change Password Card ─────────────────────────────────────────────
function ChangePasswordCard() {
    const [step, setStep] = useState('idle');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [maskedMobile, setMaskedMobile] = useState('');
    const [verifiedToken, setVerifiedToken] = useState('');
    const [countdown, setCountdown] = useState(0);
    const timerRef = useRef(null);

    useEffect(() => {
        if (countdown > 0) {
            timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
        }
        return () => clearTimeout(timerRef.current);
    }, [countdown]);

    const handleSendOtp = async () => {
        setLoading(true);
        try {
            const { data } = await api.sendClientPasswordChangeOtp();
            setMaskedMobile(data.mobile || '');
            setStep('otp_sent');
            setCountdown(60);
            toast.success(data.message || 'OTP sent to your registered mobile number.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim() || otp.length < 4) return toast.error('Please enter the 6-digit OTP.');
        setLoading(true);
        try {
            const { data } = await api.verifyClientPasswordChangeOtp({ otp: otp.trim() });
            setVerifiedToken(data.verifiedToken);
            setOtp('');
            setStep('otp_verified');
            toast.success('OTP verified successfully.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!isStrongPassword(newPassword)) return toast.error(PASSWORD_POLICY_TEXT);
        if (newPassword !== confirmPwd) return toast.error('Passwords do not match.');

        setLoading(true);
        try {
            const { data } = await api.changeClientPasswordWithOtp({ verifiedToken, newPassword });
            toast.success(data.message || 'Password changed successfully.');
            setStep('done');
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/login';
            }, 1500);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    const strength = getPasswordStrength(newPassword);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5"
        >
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md flex-shrink-0">
                    <Key size="20" className="text-white" />
                </div>
                <div className="flex-1">
                    <h2 className="font-bold text-gray-800 text-base">Change Password</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Secure OTP-based password reset for logged-in users</p>

                    {step === 'idle' && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSendOtp}
                            disabled={loading}
                            className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:shadow-md transition-all disabled:opacity-60"
                        >
                            {loading && <Loader2 size="14" className="animate-spin" />}
                            Send OTP
                        </motion.button>
                    )}

                    {step === 'otp_sent' && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 space-y-3"
                        >
                            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                                <CheckCircle2 size="14" className="text-emerald-600" />
                                <p className="text-xs text-emerald-700 font-medium">
                                    OTP sent to <span className="font-bold">{maskedMobile}</span>
                                </p>
                            </div>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="Enter 6-digit OTP"
                                maxLength={6}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                            />
                            <div className="flex items-center gap-2">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleVerifyOtp}
                                    disabled={loading || !otp || otp.length !== 6}
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:shadow-md transition-all disabled:opacity-60"
                                >
                                    {loading && <Loader2 size="14" className="animate-spin" />}
                                    Verify OTP
                                </motion.button>
                                {countdown > 0 ? (
                                    <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                                        <Clock size="12" /> {countdown}s
                                    </span>
                                ) : (
                                    <button onClick={handleSendOtp} className="text-xs text-orange-600 font-semibold hover:underline">
                                        Resend OTP
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 'otp_verified' && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 space-y-3"
                        >
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-3 py-2">
                                <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                                    <Shield size="12" /> Verified — set your new password
                                </p>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="New password"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPwd((v) => !v)} 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPwd ? <EyeOff size="16" /> : <Eye size="16" />}
                                </button>
                            </div>

                            {!!newPassword && (
                                <div className="space-y-1">
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: strength.width }} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className={`text-xs font-medium ${strength.text}`}>Strength: {strength.label}</p>
                                        <p className="text-xs text-gray-400">{Math.round(parseFloat(strength.width))}%</p>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">{PASSWORD_POLICY_TEXT}</p>
                                </div>
                            )}

                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPwd}
                                    onChange={(e) => setConfirmPwd(e.target.value)}
                                    placeholder="Confirm password"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowConfirm((v) => !v)} 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirm ? <EyeOff size="16" /> : <Eye size="16" />}
                                </button>
                            </div>
                            {confirmPwd && newPassword !== confirmPwd && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertTriangle size="10" /> Passwords do not match
                                </p>
                            )}

                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleChangePassword}
                                disabled={loading || !isStrongPassword(newPassword) || newPassword !== confirmPwd}
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:shadow-md transition-all disabled:opacity-60"
                            >
                                {loading && <Loader2 size="14" className="animate-spin" />}
                                Update Password
                            </motion.button>
                        </motion.div>
                    )}

                    {step === 'done' && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3"
                        >
                            <p className="text-sm text-emerald-700 inline-flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg">
                                <CheckCircle2 size="16" /> Password updated. Redirecting to login...
                            </p>
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── Main Settings Component ─────────────────────────────────────────────────
const Settings = () => {
    const navigate = useNavigate();
    const { restartGuideFromSettings } = useClientOnboarding();
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [profile, setProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    const CONFIRM_PHRASE = 'DELETE';

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const { data } = await api.getClientProfile();
                setProfile(data);
            } catch {
                // Silently fail
            } finally {
                setLoadingProfile(false);
            }
        };
        loadProfile();
    }, []);

    const handleDeleteAccount = async () => {
        if (confirmText !== CONFIRM_PHRASE) {
            toast.error(`Type "${CONFIRM_PHRASE}" to confirm.`);
            return;
        }
        setDeleting(true);
        try {
            await api.deleteClientAccount();
            toast.success('Your account has been permanently deleted.');
            localStorage.clear();
            navigate('/register');
        } catch {
            toast.error('Failed to delete account. Please try again.');
        } finally {
            setDeleting(false);
            setShowConfirm(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="client-page-settings"
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <SettingsIcon size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Settings</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Manage your account preferences</p>
                                </div>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={restartGuideFromSettings}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                            >
                                <BookOpen size="16" /> User Guide
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Profile Summary Card */}
                {!loadingProfile && profile && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-xl border border-gray-100 shadow-md p-5 mb-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                                <User size="24" className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-800 text-base">{profile.name}</h3>
                                <p className="text-xs text-gray-500 font-mono">{profile.karigarId}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{profile.email || 'Email not set'}</p>
                            </div>
                            {profile.verificationStatus === 'approved' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                                    <CheckCircle2 size="10" /> Verified
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Settings Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden mb-6"
                >
                    {/* Change Password Section */}
                    <ChangePasswordCard />

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Change Mobile Number */}
                    <div className="p-5">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md flex-shrink-0">
                                <Smartphone size="20" className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-bold text-gray-800 text-base">Change Mobile Number</h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Your mobile number is tied to your KarigarConnect identity. Contact support to update it.
                                </p>
                                <button className="mt-3 text-xs text-orange-600 font-semibold hover:underline">
                                    Contact Support →
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Privacy & Data */}
                    <div className="p-5">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md flex-shrink-0">
                                <Shield size="20" className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-bold text-gray-800 text-base">Privacy & Data</h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Your data is stored securely and only accessible to authorised personnel.
                                </p>
                                <div className="flex items-center gap-2 mt-3">
                                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <span>256-bit encrypted</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <span>GDPR compliant</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Danger Zone */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h2 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
                        <AlertTriangle size="14" />
                        Danger Zone
                    </h2>
                    <div className="bg-white rounded-xl border border-red-200 shadow-md overflow-hidden">
                        <div className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-md flex-shrink-0">
                                        <Trash2 size="20" className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-gray-800 text-base">Delete Account</h2>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Once deleted, your profile, job history, and all data will be permanently removed.
                                        </p>
                                    </div>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setConfirmText(''); setShowConfirm(true); }}
                                    className="flex-shrink-0 flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:shadow-md transition-all"
                                >
                                    <Trash2 size="14" />
                                    Delete Account
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Trust Badge */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-center mt-8"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100">
                        <ShieldCheck size="14" className="text-emerald-500" />
                        <span className="text-[10px] text-gray-500">Your data is encrypted and secure</span>
                        <Lock size="10" className="text-gray-400" />
                    </div>
                </motion.div>
            </div>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-red-500 to-rose-500 p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                            <AlertTriangle size="18" className="text-white" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white">Delete Account</h3>
                                    </div>
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        className="text-white/80 hover:text-white transition-colors"
                                    >
                                        <X size="20" />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-5 space-y-4">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                                        <AlertTriangle size="14" />
                                        This action is permanent and cannot be undone!
                                    </p>
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    All your profile data, job history, and account information will be deleted immediately.
                                </p>
                                <p className="text-sm text-gray-700 font-medium">
                                    Type <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{CONFIRM_PHRASE}</span> to confirm:
                                </p>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder={`Type ${CONFIRM_PHRASE} here`}
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                                    autoFocus
                                />
                            </div>

                            {/* Actions */}
                            <div className="p-5 pt-0 flex gap-3">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleDeleteAccount}
                                    disabled={deleting || confirmText !== CONFIRM_PHRASE}
                                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:shadow-md transition-colors disabled:opacity-50"
                                >
                                    {deleting ? (
                                        <Loader2 size="14" className="animate-spin" />
                                    ) : (
                                        <>
                                            <Trash2 size="14" />
                                            Delete Permanently
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Settings;