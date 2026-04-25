import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock, Smartphone, Eye, EyeOff, ShieldAlert,
    ChevronRight, LogOut, Loader2, CheckCircle2,
    AlertTriangle, User, Key, Trash2, BookOpen,
    Shield, Verified, Mail, Phone, Fingerprint,
    Settings as SettingsIcon, Globe, Bell, Clock,
    Award, TrendingUp, Star, Sparkles, Crown
} from 'lucide-react';
import { PASSWORD_POLICY_TEXT, getPasswordStrength, isStrongPassword } from '../../constants/passwordPolicy';
import { useWorkerOnboarding } from '../../context/WorkerOnboardingContext';

// ── Password Strength Meter ─────────────────────────────────────────────────
function PasswordStrengthMeter({ password }) {
    const strength = getPasswordStrength(password);
    if (!password) return null;

    return (
        <div className="mt-2 space-y-1">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: strength.width }}
                    transition={{ duration: 0.5 }}
                    className={`h-full ${strength.color} transition-all duration-300`} 
                />
            </div>
            <div className="flex items-center justify-between">
                <p className={`text-xs font-medium ${strength.text}`}>
                    Strength: {strength.label}
                </p>
                <p className="text-[10px] text-gray-400">
                    {Math.round(parseFloat(strength.width))}% secure
                </p>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
                {PASSWORD_POLICY_TEXT}
            </p>
        </div>
    );
}

// ── Change Password Section ─────────────────────────────────────────────────
function ChangePasswordSection() {
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
    const [expanded, setExpanded] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        if (countdown > 0) {
            timerRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timerRef.current);
    }, [countdown]);

    const handleSendOtp = async () => {
        setLoading(true);
        try {
            const { data } = await api.sendPasswordChangeOtp();
            setMaskedMobile(data.mobile || '');
            setStep('otp_sent');
            setCountdown(60);
            toast.success(data.message || 'OTP sent to your registered mobile number!');
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
            const { data } = await api.verifyPasswordChangeOtp({ otp: otp.trim() });
            setVerifiedToken(data.verifiedToken);
            setOtp('');
            setStep('otp_verified');
            toast.success('OTP verified successfully!');
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
            const { data } = await api.changePasswordWithOtp({ verifiedToken, newPassword });
            toast.success(data.message || 'Password changed successfully!');
            setStep('done');
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/login';
            }, 2000);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to change password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep('idle');
        setOtp('');
        setNewPassword('');
        setConfirmPwd('');
        setVerifiedToken('');
        setExpanded(false);
    };

    return (
        <motion.div 
            initial={false}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-lg transition-all overflow-hidden"
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                        <Key size="18" className="text-white" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-gray-800 text-sm">Change Password</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Secure your account with OTP verification</p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: expanded ? 90 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <ChevronRight size="18" className="text-gray-400" />
                </motion.div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                            {step === 'done' && (
                                <div className="text-center py-8">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 200 }}
                                        className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
                                    >
                                        <CheckCircle2 size="32" className="text-white" />
                                    </motion.div>
                                    <p className="font-bold text-gray-800 text-lg mb-1">Password Updated!</p>
                                    <p className="text-sm text-gray-500 mb-3">Logging you out for security...</p>
                                    <Loader2 size="24" className="animate-spin mx-auto text-orange-500" />
                                </div>
                            )}

                            {step === 'idle' && (
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={handleSendOtp}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg"
                                >
                                    {loading ? <Loader2 size="16" className="animate-spin" /> : <Smartphone size="16" />}
                                    Send OTP to Mobile
                                </motion.button>
                            )}

                            {step === 'otp_sent' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-3">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size="14" className="text-emerald-600" />
                                            <p className="text-xs text-emerald-700 font-medium">
                                                OTP sent to <span className="font-bold">{maskedMobile}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={otp}
                                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                            placeholder="Enter 6-digit OTP"
                                            maxLength={6}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-xl font-black tracking-[0.5em] focus:ring-2 focus:ring-orange-300 outline-none transition-all"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleVerifyOtp}
                                            disabled={loading || otp.length !== 6}
                                            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 size="16" className="animate-spin mx-auto" /> : 'Verify OTP'}
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        {countdown > 0 ? (
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock size="12" /> Resend in {countdown}s
                                            </span>
                                        ) : (
                                            <button onClick={handleSendOtp} className="text-xs text-orange-500 font-semibold hover:underline">
                                                Resend OTP
                                            </button>
                                        )}
                                        <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
                                            Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'otp_verified' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert size="14" className="text-blue-600" />
                                            <p className="text-xs text-blue-700 font-medium">
                                                Verified! Set your new password
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPwd ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-orange-300 transition-all"
                                                placeholder="Enter new password"
                                            />
                                            <button
                                                onClick={() => setShowPwd(!showPwd)}
                                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPwd ? <EyeOff size="16" /> : <Eye size="16" />}
                                            </button>
                                        </div>
                                        <PasswordStrengthMeter password={newPassword} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirm ? 'text' : 'password'}
                                                value={confirmPwd}
                                                onChange={e => setConfirmPwd(e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-orange-300 transition-all"
                                                placeholder="Confirm new password"
                                            />
                                            <button
                                                onClick={() => setShowConfirm(!showConfirm)}
                                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                            >
                                                {showConfirm ? <EyeOff size="16" /> : <Eye size="16" />}
                                            </button>
                                        </div>
                                        {confirmPwd && newPassword !== confirmPwd && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                <AlertTriangle size="10" /> Passwords do not match
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={loading || newPassword !== confirmPwd || !isStrongPassword(newPassword)}
                                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-md"
                                    >
                                        {loading ? <Loader2 size="16" className="animate-spin mx-auto" /> : 'Update Password'}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Delete Account Section ─────────────────────────────────────────────────
function DeleteAccountSection() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState('confirm');
    const [otp, setOtp] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [maskedMobile, setMaskedMobile] = useState('');
    const [verifiedToken, setVerifiedToken] = useState('');

    const handleSendOtp = async () => {
        setLoading(true);
        try {
            const { data } = await api.sendPasswordChangeOtp();
            setMaskedMobile(data.mobile || '');
            setStep('otp_sent');
            toast.success('OTP sent for verification');
        } catch {
            toast.error('Could not send OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 4) return toast.error('Please enter valid OTP');
        setLoading(true);
        try {
            const { data } = await api.verifyPasswordChangeOtp({ otp });
            setVerifiedToken(data.verifiedToken);
            setStep('otp_verified');
            toast.success('OTP verified');
        } catch {
            toast.error('Incorrect OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (confirmText !== 'DELETE') return toast.error('Please type DELETE to confirm.');
        setLoading(true);
        try {
            await api.deleteAccountPermanently({ verifiedToken, confirmText });
            toast.success('Account deleted permanently.');
            localStorage.clear();
            navigate('/register');
        } catch {
            toast.error('Failed to delete account.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div className="bg-white rounded-xl border border-red-200 shadow-md hover:shadow-lg transition-all overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-md">
                        <Trash2 size="18" className="text-white" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-red-600 text-sm">Delete Account</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Permanent and irreversible action</p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: open ? 90 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <ChevronRight size="18" className="text-gray-400" />
                </motion.div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-2 border-t border-red-100">
                            {step === 'confirm' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gradient-to-r from-red-50 to-rose-50 p-4 rounded-xl border border-red-200"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                            <AlertTriangle size="18" className="text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-red-700 mb-1">
                                                ⚠️ Warning: This action cannot be undone!
                                            </p>
                                            <p className="text-xs text-red-600 leading-relaxed">
                                                This will permanently delete your profile, ratings, work history, and all associated data.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSendOtp}
                                        className="w-full mt-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-lg text-sm font-bold transition-all shadow-md"
                                    >
                                        Continue to Delete
                                    </button>
                                </motion.div>
                            )}

                            {step === 'otp_sent' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-3"
                                >
                                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                                        <p className="text-xs text-blue-700 font-medium">
                                            Enter OTP sent to <span className="font-bold">{maskedMobile}</span>
                                        </p>
                                    </div>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                        placeholder="6-digit OTP"
                                        maxLength={6}
                                        className="w-full border border-gray-200 rounded-xl p-3 text-center text-lg font-bold tracking-[0.3em] focus:ring-2 focus:ring-red-300 outline-none"
                                    />
                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={!otp || otp.length !== 6}
                                        className="w-full py-2.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                                    >
                                        Verify & Continue
                                    </button>
                                </motion.div>
                            )}

                            {step === 'otp_verified' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-3"
                                >
                                    <p className="text-xs font-bold text-gray-700">
                                        Type <span className="text-red-600 text-base font-black">DELETE</span> to permanently remove your account:
                                    </p>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value.toUpperCase())}
                                        placeholder="Type DELETE here"
                                        className="w-full border-2 border-red-300 rounded-xl p-3 text-center font-black text-red-600 bg-red-50 focus:ring-2 focus:ring-red-300 outline-none"
                                    />
                                    <button
                                        onClick={handleDelete}
                                        disabled={confirmText !== 'DELETE' || loading}
                                        className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg font-black text-sm transition-all disabled:opacity-50 shadow-lg"
                                    >
                                        {loading ? <Loader2 size="16" className="animate-spin mx-auto" /> : 'DELETE ACCOUNT PERMANENTLY'}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Main Settings Page ──────────────────────────────────────────────────────
const Settings = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const { restartGuideFromSettings } = useWorkerOnboarding();

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.getWorkerProfile();
                setProfile(data);
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleLogout = () => {
        toast.custom((t) => (
            <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
                >
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mx-auto mb-4">
                        <LogOut size="24" className="text-orange-500" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg text-center mb-2">Logout?</h3>
                    <p className="text-gray-500 text-sm text-center mb-5">Are you sure you want to logout from your account?</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                localStorage.clear();
                                toast.dismiss(t.id);
                                navigate('/login');
                            }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all"
                        >
                            Logout
                        </button>
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </motion.div>
            </div>
        ), { duration: 5000 });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-settings"
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <SettingsIcon size="24" className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black">Settings</h1>
                                <p className="text-white/90 text-sm mt-0.5">Manage your account and security preferences</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <Loader2 size="48" className="animate-spin text-orange-500 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">Loading your settings...</p>
                        </div>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-4"
                    >
                        {/* Profile Card */}
                        {profile && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-lg transition-all overflow-hidden"
                            >
                                <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md">
                                            <User size="18" className="text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">Account Information</p>
                                            <p className="text-[11px] text-gray-400">Your personal details</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-5 py-4 space-y-3">
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <User size="12" /> Full Name
                                        </span>
                                        <span className="font-bold text-gray-800">{profile.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <Verified size="12" /> Karigar ID
                                        </span>
                                        <span className="font-mono text-sm font-bold text-gray-800">{profile.karigarId}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <Phone size="12" /> Mobile Number
                                        </span>
                                        <span className="font-bold text-gray-800">
                                            {profile.mobile?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                                        </span>
                                    </div>
                                    {profile.email && (
                                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                                <Mail size="12" /> Email
                                            </span>
                                            <span className="text-sm text-gray-600">{profile.email}</span>
                                        </div>
                                    )}
                                    {profile.verificationStatus === 'approved' && (
                                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                                <Shield size="12" /> Verification
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                                                <Verified size="10" /> Verified Account
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Security Section */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 flex items-center gap-1">
                                <Shield size="12" /> Security
                            </p>
                            <ChangePasswordSection />
                        </div>

                        {/* Support Section */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 flex items-center gap-1">
                                <Sparkles size="12" /> Support & Resources
                            </p>
                            
                            {/* User Guide */}
                            <motion.button
                                whileHover={{ x: 4 }}
                                onClick={restartGuideFromSettings}
                                className="w-full bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-lg transition-all px-5 py-4 flex items-center gap-3 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                    <BookOpen size="18" className="text-white" />
                                </div>
                                <div className="text-left flex-grow">
                                    <p className="font-bold text-gray-800 text-sm">User Guide</p>
                                    <p className="text-[11px] text-gray-400">Restart onboarding walkthrough</p>
                                </div>
                                <ChevronRight size="18" className="text-gray-300 group-hover:text-orange-500 transition-colors" />
                            </motion.button>

                            {/* App Version */}
                            <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
                                <div className="flex justify-between items-center px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center shadow-md">
                                            <Award size="18" className="text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">App Version</p>
                                            <p className="text-[11px] text-gray-400">Karigar Platform</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                                        v2.2.0
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-red-500 uppercase tracking-wider px-1 flex items-center gap-1">
                                <AlertTriangle size="12" /> Danger Zone
                            </p>
                            
                            {/* Logout Button */}
                            <motion.button
                                whileHover={{ x: 4 }}
                                onClick={handleLogout}
                                className="w-full bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-lg transition-all px-5 py-4 flex items-center gap-3 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center group-hover:bg-red-100 transition-all">
                                    <LogOut size="18" className="text-gray-500 group-hover:text-red-600" />
                                </div>
                                <div className="text-left flex-grow">
                                    <p className="font-bold text-gray-800 text-sm">Log Out</p>
                                    <p className="text-[11px] text-gray-400">Sign out of your account</p>
                                </div>
                                <ChevronRight size="18" className="text-gray-300" />
                            </motion.button>

                            {/* Delete Account */}
                            <DeleteAccountSection />
                        </div>

                        {/* Trust Badge */}
                        <div className="text-center pt-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100">
                                <Shield size="12" className="text-emerald-500" />
                                <span className="text-[10px] text-gray-500">Your data is encrypted and secure</span>
                                <Lock size="10" className="text-gray-400" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Settings;