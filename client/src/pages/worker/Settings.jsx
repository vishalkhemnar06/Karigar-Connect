// src/pages/worker/Settings.jsx
// MOBILE-FRIENDLY & ENHANCED VERSION
// Features: Responsive design, touch-friendly, modern animations, password strength meter, OTP countdown

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock, Smartphone, Eye, EyeOff, ShieldAlert,
    ChevronRight, LogOut, Loader2, CheckCircle2,
    AlertTriangle, User, Key, Trash2, Shield,
    Fingerprint, AlertCircle, Clock, Mail,
    Phone, Info, ArrowLeft, Home, ShieldCheck,
    Sparkles, Zap
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHANGE PASSWORD SECTION (ENHANCED WITH STRENGTH METER)
// ─────────────────────────────────────────────────────────────────────────────
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
        if (newPassword.length < 6) return toast.error('Password must be at least 6 characters long.');
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

    const getPasswordStrength = (p) => {
        if (!p) return null;
        let score = 0;
        if (p.length >= 8) score++;
        if (p.match(/[a-z]/)) score++;
        if (p.match(/[A-Z]/)) score++;
        if (p.match(/[0-9]/)) score++;
        if (p.match(/[^a-zA-Z0-9]/)) score++;
        
        if (score <= 2) return { label: 'Weak', color: 'bg-red-500', text: 'text-red-600', bgLight: 'bg-red-50', width: '33%' };
        if (score <= 4) return { label: 'Medium', color: 'bg-yellow-500', text: 'text-yellow-600', bgLight: 'bg-yellow-50', width: '66%' };
        return { label: 'Strong', color: 'bg-green-500', text: 'text-green-600', bgLight: 'bg-green-50', width: '100%' };
    };
    
    const strength = getPasswordStrength(newPassword);

    return (
        <motion.div 
            initial={false}
            animate={{ height: 'auto' }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-r from-orange-100 to-amber-100 flex items-center justify-center">
                        <Key size={14} className="text-orange-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-gray-900 text-xs sm:text-sm">Change Password</p>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Secure your account with OTP verification</p>
                    </div>
                </div>
                <ChevronRight size={16} className={`text-gray-400 transition-transform duration-300 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
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
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 space-y-4">
                            {step === 'done' && (
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center py-6 sm:py-8"
                                >
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', delay: 0.2 }}
                                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg"
                                    >
                                        <CheckCircle2 size={32} className="text-white" />
                                    </motion.div>
                                    <p className="font-bold text-gray-900 text-lg sm:text-xl">Password Updated!</p>
                                    <p className="text-xs sm:text-sm text-gray-500 mt-2">Logging you out for security...</p>
                                    <Loader2 size={20} className="animate-spin mx-auto mt-4 text-orange-500" />
                                </motion.div>
                            )}

                            {step === 'idle' && (
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={handleSendOtp}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                                    Send OTP to Mobile
                                </motion.button>
                            )}

                            {step === 'otp_sent' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="space-y-4"
                                >
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs sm:text-sm text-green-700">
                                                OTP sent to <span className="font-bold">{maskedMobile}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={otp}
                                            onChange={e => setOtp(e.target.value)}
                                            placeholder="Enter 6-digit OTP"
                                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-base sm:text-xl font-black tracking-widest focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                                            autoFocus
                                        />
                                        <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={loading || !otp || otp.length < 4}
                                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95"
                                    >
                                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Verify OTP'}
                                    </button>
                                    <div className="flex justify-between items-center text-xs">
                                        {countdown > 0 ? (
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <Clock size={12} />
                                                <span>Resend in {countdown}s</span>
                                            </div>
                                        ) : (
                                            <button onClick={handleSendOtp} className="text-orange-500 font-bold hover:underline">
                                                Resend OTP
                                            </button>
                                        )}
                                        <button onClick={reset} className="text-gray-400 hover:text-gray-600">
                                            Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'otp_verified' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="space-y-4"
                                >
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                        <div className="flex items-start gap-2">
                                            <ShieldAlert size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs sm:text-sm text-blue-700">
                                                Verified! Set your new password
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPwd ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all"
                                                placeholder="Enter new password"
                                            />
                                            <button
                                                onClick={() => setShowPwd(!showPwd)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {strength && newPassword && (
                                            <div className="mt-3 space-y-1">
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        className={`h-full ${strength.color} rounded-full`} 
                                                        style={{ width: strength.width }}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: strength.width }}
                                                        transition={{ duration: 0.5 }}
                                                    />
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <p className={`text-[10px] sm:text-xs ${strength.text} font-medium`}>
                                                        {strength.label} password
                                                    </p>
                                                    <p className="text-[10px] text-gray-400">
                                                        {newPassword.length}/min 6 chars
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirm ? 'text' : 'password'}
                                                value={confirmPwd}
                                                onChange={e => setConfirmPwd(e.target.value)}
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all"
                                                placeholder="Confirm new password"
                                            />
                                            <button
                                                onClick={() => setShowConfirm(!showConfirm)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {confirmPwd && newPassword !== confirmPwd && (
                                            <motion.p 
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="text-[10px] sm:text-xs text-red-500 mt-1 flex items-center gap-1"
                                            >
                                                <AlertCircle size={10} /> Passwords do not match
                                            </motion.p>
                                        )}
                                        {confirmPwd && newPassword === confirmPwd && newPassword.length >= 6 && (
                                            <motion.p 
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="text-[10px] sm:text-xs text-green-500 mt-1 flex items-center gap-1"
                                            >
                                                <CheckCircle2 size={10} /> Passwords match
                                            </motion.p>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleChangePassword}
                                        disabled={loading || newPassword !== confirmPwd || newPassword.length < 6}
                                        className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95 shadow-md"
                                    >
                                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Update Password'}
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. DELETE ACCOUNT SECTION (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────
function DeleteAccountSection() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState('confirm');
    const [otp, setOtp] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [maskedMobile, setMaskedMobile] = useState('');
    const [verifiedToken, setVerifiedToken] = useState('');
    const [countdown, setCountdown] = useState(0);
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
            toast.success('OTP sent for verification');
        } catch (err) {
            toast.error('Could not send OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) return toast.error('Please enter OTP');
        setLoading(true);
        try {
            const { data } = await api.verifyPasswordChangeOtp({ otp });
            setVerifiedToken(data.verifiedToken);
            setStep('otp_verified');
            toast.success('OTP verified');
        } catch (err) {
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
        } catch (err) {
            toast.error('Failed to delete account.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 hover:bg-red-50 transition-colors active:bg-red-100"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-100 flex items-center justify-center">
                        <Trash2 size={14} className="text-red-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-red-700 text-xs sm:text-sm">Delete Account</p>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Permanent and irreversible action</p>
                    </div>
                </div>
                <ChevronRight size={16} className={`text-gray-400 transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
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
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 space-y-4">
                            {step === 'confirm' && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-red-50 p-4 rounded-xl border border-red-200"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                            <AlertTriangle size={16} className="text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-red-700 font-bold mb-2">
                                                Warning: This action cannot be undone!
                                            </p>
                                            <p className="text-xs text-red-600 leading-relaxed">
                                                This will permanently delete your profile, ratings, work history, and all associated data.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSendOtp}
                                        className="w-full mt-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg text-sm font-bold transition-all active:scale-95"
                                    >
                                        Continue to Delete
                                    </button>
                                </motion.div>
                            )}

                            {step === 'otp_sent' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="space-y-3"
                                >
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                        <p className="text-xs text-green-700">
                                            <CheckCircle2 size={12} className="inline mr-1" />
                                            OTP sent to <span className="font-bold">{maskedMobile}</span>
                                        </p>
                                    </div>
                                    <input
                                        type="number"
                                        value={otp}
                                        onChange={e => setOtp(e.target.value)}
                                        placeholder="Enter 6-digit OTP"
                                        className="w-full border-2 border-gray-200 rounded-xl p-3 text-center font-bold text-lg tracking-widest focus:border-red-400 focus:ring-4 focus:ring-red-50 outline-none transition-all"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={!otp || otp.length < 4}
                                        className="w-full py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-bold transition-all disabled:opacity-50 active:scale-95"
                                    >
                                        Verify & Continue
                                    </button>
                                    {countdown > 0 ? (
                                        <p className="text-center text-xs text-gray-400">Resend in {countdown}s</p>
                                    ) : (
                                        <button onClick={handleSendOtp} className="text-center text-xs text-red-500 font-bold w-full">
                                            Resend OTP
                                        </button>
                                    )}
                                </motion.div>
                            )}

                            {step === 'otp_verified' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="space-y-3"
                                >
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                        <p className="text-xs font-bold text-gray-700 mb-3 text-center">
                                            Type <span className="text-red-600 text-lg font-black">DELETE</span> to permanently remove your account:
                                        </p>
                                        <input
                                            type="text"
                                            value={confirmText}
                                            onChange={e => setConfirmText(e.target.value)}
                                            placeholder="Type DELETE here"
                                            className="w-full border-2 border-red-300 rounded-xl p-3 text-center font-bold text-red-600 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition-all uppercase"
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        onClick={handleDelete}
                                        disabled={confirmText !== 'DELETE' || loading}
                                        className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-black transition-all disabled:opacity-50 active:scale-95 shadow-md"
                                    >
                                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'DELETE ACCOUNT PERMANENTLY'}
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. MAIN SETTINGS PAGE (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────
const Settings = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

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
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full mx-4"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <LogOut size={18} className="text-red-600" />
                    </div>
                    <p className="font-bold text-gray-900">Logout Confirmation</p>
                </div>
                <p className="text-gray-600 text-sm mb-4">Are you sure you want to logout from your account?</p>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            localStorage.clear();
                            toast.dismiss(t.id);
                            navigate('/login');
                        }}
                        className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-2.5 rounded-xl text-sm font-bold active:scale-95"
                    >
                        Logout
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-bold active:scale-95"
                    >
                        Cancel
                    </button>
                </div>
            </motion.div>
        ), { duration: 5000 });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24">
                {/* Header with back button */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 sm:mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl hover:bg-white/50 transition-all active:scale-95"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                                Settings
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                Manage your account and security settings
                            </p>
                        </div>
                    </div>
                </motion.div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
                        />
                        <p className="text-gray-500 mt-4 text-sm">Loading your settings...</p>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-4"
                    >
                        {/* Account Info Card - Enhanced */}
                        {profile && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                            >
                                <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 sm:px-5 py-3 sm:py-4 border-b border-orange-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                                            <User size={14} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-xs sm:text-sm">Account Information</p>
                                            <p className="text-[10px] sm:text-xs text-gray-500">Your profile details</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-4 sm:px-5 py-4 space-y-3">
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <User size={10} /> Full Name
                                        </span>
                                        <span className="font-bold text-gray-800 text-sm">{profile.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <Fingerprint size={10} /> Karigar ID
                                        </span>
                                        <span className="font-mono text-xs sm:text-sm font-bold text-gray-800">{profile.karigarId}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <Phone size={10} /> Mobile Number
                                        </span>
                                        <span className="font-bold text-gray-800 text-sm">
                                            {profile.mobile?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                                        </span>
                                    </div>
                                    {profile.email && (
                                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                            <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                                <Mail size={10} /> Email
                                            </span>
                                            <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[200px]">{profile.email}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <ShieldCheck size={10} /> Verification Status
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                            <CheckCircle2 size={10} /> Verified
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Security Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                                <Shield size={12} className="text-gray-400" />
                                <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Security</p>
                            </div>
                            <ChangePasswordSection />
                        </div>

                        {/* Logout Button - Enhanced */}
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleLogout}
                            className="w-full bg-white border border-gray-100 rounded-2xl shadow-sm px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-3 hover:bg-red-50 transition-all group"
                        >
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-red-100 transition-all">
                                <LogOut size={14} className="text-gray-500 group-hover:text-red-600" />
                            </div>
                            <div className="text-left flex-grow">
                                <p className="font-bold text-gray-900 text-xs sm:text-sm">Log Out</p>
                                <p className="text-[10px] sm:text-xs text-gray-400">Sign out of your account</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-300 group-hover:text-red-400 transition-colors" />
                        </motion.button>

                        {/* Delete Account */}
                        <DeleteAccountSection />

                        {/* App Info - Enhanced */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex justify-between px-4 sm:px-5 py-3 sm:py-4 items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
                                        <Sparkles size={14} className="text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-xs sm:text-sm">Karigar Platform</p>
                                        <p className="text-[10px] sm:text-xs text-gray-400">Connecting skilled workers</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold text-gray-400">v2.2.0</span>
                                    <p className="text-[8px] text-gray-300">Latest</p>
                                </div>
                            </div>
                            <div className="border-t border-gray-100 px-4 sm:px-5 py-3 bg-gray-50">
                                <p className="text-[9px] text-gray-400 text-center">
                                        © {new Date().getFullYear()} KarigarConnect — Secure & Verified
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Settings;