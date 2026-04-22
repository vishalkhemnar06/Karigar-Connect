import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock, Smartphone, Eye, EyeOff, ShieldAlert,
    ChevronRight, LogOut, Loader2, CheckCircle2,
    AlertTriangle, User, Key, Trash2, BookOpen
} from 'lucide-react';
import { PASSWORD_POLICY_TEXT, getPasswordStrength, isStrongPassword } from '../../constants/passwordPolicy';
import { useWorkerOnboarding } from '../../context/WorkerOnboardingContext';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHANGE PASSWORD SECTION (ENHANCED)
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

    const strength = getPasswordStrength(newPassword);

    return (
        <motion.div 
            initial={false}
            animate={{ height: 'auto' }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                        <Key size={16} className="text-orange-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-gray-900 text-sm">Change Password</p>
                        <p className="text-xs text-gray-400 mt-0.5">Secure your account with OTP verification</p>
                    </div>
                </div>
                <ChevronRight size={16} className={`text-gray-400 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} />
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
                        <div className="px-5 pb-5 pt-2">
                            {step === 'done' && (
                                <div className="text-center py-6">
                                    <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
                                    <p className="font-bold text-gray-900 text-lg">Password Updated!</p>
                                    <p className="text-sm text-gray-500 mt-2">Logging you out for security...</p>
                                    <Loader2 size={20} className="animate-spin mx-auto mt-4 text-orange-500" />
                                </div>
                            )}

                            {step === 'idle' && (
                                <button
                                    onClick={handleSendOtp}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold text-sm transition-all duration-200 transform hover:scale-[1.02]"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                                    Send OTP to Mobile
                                </button>
                            )}

                            {step === 'otp_sent' && (
                                <div className="space-y-4">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                        <p className="text-xs text-green-700">
                                            <CheckCircle2 size={12} className="inline mr-1" />
                                            OTP sent to <b>{maskedMobile}</b>
                                        </p>
                                    </div>
                                    <input
                                        type="number"
                                        value={otp}
                                        onChange={e => setOtp(e.target.value)}
                                        placeholder="Enter 6-digit OTP"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-xl font-black tracking-widest focus:ring-2 focus:ring-orange-300 outline-none transition-all"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={loading || !otp}
                                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Verify OTP'}
                                    </button>
                                    <div className="flex justify-between text-xs">
                                        {countdown > 0 ? (
                                            <span className="text-gray-400">Resend in {countdown}s</span>
                                        ) : (
                                            <button onClick={handleSendOtp} className="text-orange-500 font-bold hover:underline">
                                                Resend OTP
                                            </button>
                                        )}
                                        <button onClick={reset} className="text-gray-400 hover:text-gray-600">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 'otp_verified' && (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-xs text-blue-700">
                                            <ShieldAlert size={12} className="inline mr-1" />
                                            Verified! Set your new password
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPwd ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                                                placeholder="Enter new password"
                                            />
                                            <button
                                                onClick={() => setShowPwd(!showPwd)}
                                                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {newPassword && (
                                            <div className="mt-2">
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: strength.width }} />
                                                </div>
                                                <p className={`text-xs mt-1 ${strength.text}`}>
                                                    Password strength: {strength.label}
                                                </p>
                                                <p className="text-xs text-gray-500">{PASSWORD_POLICY_TEXT}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirm ? 'text' : 'password'}
                                                value={confirmPwd}
                                                onChange={e => setConfirmPwd(e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                                                placeholder="Confirm new password"
                                            />
                                            <button
                                                onClick={() => setShowConfirm(!showConfirm)}
                                                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                                            >
                                                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {confirmPwd && newPassword !== confirmPwd && (
                                            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={loading || newPassword !== confirmPwd || !isStrongPassword(newPassword)}
                                        className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Update Password'}
                                    </button>
                                </div>
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
        <motion.div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                        <Trash2 size={16} className="text-red-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-red-700 text-sm">Delete Account</p>
                        <p className="text-xs text-gray-400 mt-0.5">Permanent and irreversible action</p>
                    </div>
                </div>
                <ChevronRight size={16} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
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
                        <div className="px-5 pb-5 pt-2 space-y-4">
                            {step === 'confirm' && (
                                <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={16} className="text-red-600 mt-0.5" />
                                        <div>
                                            <p className="text-sm text-red-700 font-semibold mb-2">
                                                Warning: This action cannot be undone!
                                            </p>
                                            <p className="text-xs text-red-600 leading-relaxed">
                                                This will permanently delete your profile, ratings, work history, and all associated data.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSendOtp}
                                        className="w-full mt-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors"
                                    >
                                        Continue to Delete
                                    </button>
                                </div>
                            )}

                            {step === 'otp_sent' && (
                                <div className="space-y-3">
                                    <p className="text-xs text-gray-600">Enter OTP sent to {maskedMobile}</p>
                                    <input
                                        type="number"
                                        value={otp}
                                        onChange={e => setOtp(e.target.value)}
                                        placeholder="6-digit OTP"
                                        className="w-full border border-gray-200 rounded-xl p-3 text-center font-bold"
                                    />
                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={!otp}
                                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                                    >
                                        Verify & Continue
                                    </button>
                                </div>
                            )}

                            {step === 'otp_verified' && (
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-gray-700">
                                        Type <span className="text-red-600 text-base">DELETE</span> to permanently remove your account:
                                    </p>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        placeholder="Type DELETE here"
                                        className="w-full border-2 border-red-300 rounded-xl p-3 text-center font-bold text-red-600 bg-red-50"
                                    />
                                    <button
                                        onClick={handleDelete}
                                        disabled={confirmText !== 'DELETE' || loading}
                                        className="w-full py-3 bg-red-700 hover:bg-red-800 text-white rounded-lg font-black transition-colors disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'DELETE ACCOUNT PERMANENTLY'}
                                    </button>
                                </div>
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
            <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-4 max-w-sm w-full">
                    <p className="text-gray-800 mb-3">Are you sure you want to logout?</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                localStorage.clear();
                                toast.dismiss(t.id);
                                navigate('/login');
                            }}
                            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-bold"
                        >
                            Logout
                        </button>
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-bold"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        ), { duration: 5000 });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-4xl mx-auto px-4 py-6 pb-24" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>
                {/* Header with animation */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-settings"
                    className="mb-8"
                >
                    <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        Settings
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                        Manage your account and security settings
                    </p>
                </motion.div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <Loader2 className="animate-spin text-orange-500 mx-auto mb-4" size={40} />
                            <p className="text-gray-500">Loading your settings...</p>
                        </div>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-4"
                    >
                        {/* Account Info Card */}
                        {profile && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                            >
                                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <User size={16} className="text-blue-600" />
                                    </div>
                                    <p className="font-bold text-gray-900 text-sm">Account Information</p>
                                </div>
                                <div className="px-5 py-4 space-y-3">
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Full Name</span>
                                        <span className="font-bold text-gray-800">{profile.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Karigar ID</span>
                                        <span className="font-mono text-sm font-bold text-gray-800">{profile.karigarId}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mobile Number</span>
                                        <span className="font-bold text-gray-800">
                                            {profile.mobile?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                                        </span>
                                    </div>
                                    {profile.email && (
                                        <div className="flex justify-between items-center py-2 border-t border-gray-100">
                                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</span>
                                            <span className="text-sm text-gray-600">{profile.email}</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Security Section */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Security</p>
                            <ChangePasswordSection />
                        </div>

                        {/* User Guide Section */}
                        <button
                            onClick={restartGuideFromSettings}
                            className="w-full bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 flex items-center gap-3 hover:bg-orange-50 transition-all group"
                        >
                            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center group-hover:bg-orange-200">
                                <BookOpen size={16} className="text-orange-600" />
                            </div>
                            <div className="text-left flex-grow">
                                <p className="font-bold text-gray-900 text-sm">User Guide</p>
                                <p className="text-xs text-gray-400">Restart onboarding walkthrough</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-300" />
                        </button>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 flex items-center gap-3 hover:bg-red-50 transition-all group"
                        >
                            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-red-100">
                                <LogOut size={16} className="text-gray-500 group-hover:text-red-600" />
                            </div>
                            <div className="text-left flex-grow">
                                <p className="font-bold text-gray-900 text-sm">Log Out</p>
                                <p className="text-xs text-gray-400">Sign out of your account</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-300" />
                        </button>

                        {/* Delete Account */}
                        <DeleteAccountSection />

                        {/* App Info */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex justify-between px-5 py-4 items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                                        <Lock size={16} className="text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">App Version</p>
                                        <p className="text-xs text-gray-400">Karigar Platform</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-gray-400">v2.2.0</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Settings;