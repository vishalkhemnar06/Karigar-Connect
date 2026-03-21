// client/src/pages/worker/Settings.jsx
// Features:
//   1. Change Password — OTP flow (send OTP → verify → set new password, no old password needed)
//   2. Delete Account Permanently — OTP verification + typed "DELETE" confirmation
//   3. Availability toggle
//   4. Notification preferences (UI state — extend with backend as needed)
//   5. App info / version section

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import {
    Lock, Smartphone, Eye, EyeOff, ShieldAlert, ToggleLeft, ToggleRight,
    Bell, BellOff, ChevronRight, LogOut, Loader2, CheckCircle2,
    AlertTriangle, RefreshCw, User, Info, Shield,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD — 3-step OTP flow
// Step 1: Request OTP  →  Step 2: Enter OTP  →  Step 3: Enter new password
// ─────────────────────────────────────────────────────────────────────────────
function ChangePasswordSection() {
    // 'idle' | 'otp_sent' | 'otp_verified' | 'done'
    const [step,          setStep]          = useState('idle');
    const [otp,           setOtp]           = useState('');
    const [newPassword,   setNewPassword]   = useState('');
    const [confirmPwd,    setConfirmPwd]    = useState('');
    const [showPwd,       setShowPwd]       = useState(false);
    const [showConfirm,   setShowConfirm]   = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [maskedMobile,  setMaskedMobile]  = useState('');
    const [verifiedToken, setVerifiedToken] = useState('');
    const [countdown,     setCountdown]     = useState(0);
    const timerRef = useRef(null);

    // Countdown for resend
    useEffect(() => {
        if (countdown > 0) {
            timerRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timerRef.current);
    }, [countdown]);

    const startCountdown = () => setCountdown(60);

    // STEP 1 — Request OTP
    const handleSendOtp = async () => {
        setLoading(true);
        try {
            const { data } = await api.sendPasswordChangeOtp();
            setMaskedMobile(data.mobile || '');
            setStep('otp_sent');
            startCountdown();
            toast.success(data.message || 'OTP sent!');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not send OTP.');
        } finally {
            setLoading(false);
        }
    };

    // STEP 2 — Verify OTP
    const handleVerifyOtp = async () => {
        if (!otp.trim() || otp.length < 4) return toast.error('Please enter the OTP.');
        setLoading(true);
        try {
            const { data } = await api.verifyPasswordChangeOtp({ otp: otp.trim() });
            setVerifiedToken(data.verifiedToken);
            setOtp('');
            setStep('otp_verified');
            toast.success('OTP verified! Now set your new password.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Incorrect OTP.');
        } finally {
            setLoading(false);
        }
    };

    // STEP 3 — Change Password
    const handleChangePassword = async () => {
        if (!newPassword.trim())        return toast.error('Please enter a new password.');
        if (newPassword.length < 6)     return toast.error('Password must be at least 6 characters.');
        if (newPassword !== confirmPwd) return toast.error('Passwords do not match.');

        setLoading(true);
        try {
            const { data } = await api.changePasswordWithOtp({ verifiedToken, newPassword });
            toast.success(data.message || 'Password changed! Please log in again.');
            setStep('done');
            // Clear local auth — user needs to re-login
            setTimeout(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }, 2000);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep('idle');
        setOtp(''); setNewPassword(''); setConfirmPwd('');
        setVerifiedToken(''); setShowPwd(false); setShowConfirm(false);
    };

    const pwdStrength = (p) => {
        if (!p) return null;
        if (p.length < 6)  return { label: 'Too short', color: 'bg-red-400',    text: 'text-red-600' };
        if (p.length < 8)  return { label: 'Weak',      color: 'bg-orange-400', text: 'text-orange-600' };
        if (p.length < 12) return { label: 'Good',      color: 'bg-yellow-400', text: 'text-yellow-600' };
        return              { label: 'Strong',    color: 'bg-green-500',  text: 'text-green-600' };
    };
    const strength = pwdStrength(newPassword);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Lock size={16} className="text-orange-600" />
                </div>
                <div>
                    <p className="font-bold text-gray-900 text-sm">Change Password</p>
                    <p className="text-xs text-gray-400 mt-0.5">We'll send an OTP to your registered mobile number</p>
                </div>
            </div>

            <div className="px-5 py-5">
                {/* DONE state */}
                {step === 'done' && (
                    <div className="text-center py-4">
                        <CheckCircle2 size={40} className="text-green-500 mx-auto mb-2" />
                        <p className="font-bold text-gray-800">Password changed!</p>
                        <p className="text-sm text-gray-500 mt-1">Redirecting to login…</p>
                    </div>
                )}

                {/* IDLE — Request OTP button */}
                {step === 'idle' && (
                    <div className="space-y-4">
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-700">
                            <p className="font-semibold mb-0.5">How it works:</p>
                            <p>1. We send a one-time code to your registered mobile number.</p>
                            <p>2. Enter the code to verify it's you.</p>
                            <p>3. Set your new password — no old password needed.</p>
                        </div>
                        <button
                            onClick={handleSendOtp}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                            Send OTP to My Mobile
                        </button>
                    </div>
                )}

                {/* OTP SENT — Enter OTP */}
                {step === 'otp_sent' && (
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-700">
                            <p className="font-semibold">OTP sent!</p>
                            <p className="mt-0.5">Check your mobile number ending in <strong>{maskedMobile?.slice(-4)}</strong>. Valid for 10 minutes.</p>
                        </div>

                        {/* OTP input */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Enter OTP</label>
                            <input
                                type="number"
                                value={otp}
                                onChange={e => setOtp(e.target.value)}
                                maxLength={6}
                                placeholder="6-digit code"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-xl font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-300"
                            />
                        </div>

                        <button
                            onClick={handleVerifyOtp}
                            disabled={loading || !otp.trim()}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm disabled:opacity-60 transition-colors"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verify OTP'}
                        </button>

                        {/* Resend + cancel */}
                        <div className="flex items-center justify-between text-xs">
                            {countdown > 0 ? (
                                <span className="text-gray-400">Resend in {countdown}s</span>
                            ) : (
                                <button
                                    onClick={handleSendOtp}
                                    disabled={loading}
                                    className="text-orange-500 font-semibold underline disabled:opacity-50"
                                >
                                    Resend OTP
                                </button>
                            )}
                            <button onClick={reset} className="text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                    </div>
                )}

                {/* OTP VERIFIED — Set new password */}
                {step === 'otp_verified' && (
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-700 flex items-center gap-2">
                            <CheckCircle2 size={14} className="flex-shrink-0" />
                            Identity verified. Set your new password below.
                        </div>

                        {/* New password */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {/* Strength bar */}
                            {strength && (
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${strength.color}`}
                                             style={{ width: `${Math.min((newPassword.length / 12) * 100, 100)}%` }} />
                                    </div>
                                    <span className={`text-[10px] font-bold ${strength.text}`}>{strength.label}</span>
                                </div>
                            )}
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPwd}
                                    onChange={e => setConfirmPwd(e.target.value)}
                                    placeholder="Repeat new password"
                                    className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 ${
                                        confirmPwd && confirmPwd !== newPassword ? 'border-red-300' : 'border-gray-200'
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {confirmPwd && confirmPwd !== newPassword && (
                                <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                            )}
                            {confirmPwd && confirmPwd === newPassword && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={11} /> Passwords match.</p>
                            )}
                        </div>

                        <button
                            onClick={handleChangePassword}
                            disabled={loading || !newPassword || newPassword !== confirmPwd || newPassword.length < 6}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm disabled:opacity-60 transition-colors"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                            Change Password
                        </button>

                        <button onClick={reset} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 font-medium">
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE ACCOUNT — OTP verification + typed "DELETE" confirmation
// ─────────────────────────────────────────────────────────────────────────────
function DeleteAccountSection() {
    const navigate = useNavigate();
    const [open,          setOpen]          = useState(false);
    const [step,          setStep]          = useState('confirm');  // 'confirm' | 'otp_sent' | 'otp_verified'
    const [otp,           setOtp]           = useState('');
    const [confirmText,   setConfirmText]   = useState('');
    const [loading,       setLoading]       = useState(false);
    const [maskedMobile,  setMaskedMobile]  = useState('');
    const [verifiedToken, setVerifiedToken] = useState('');
    const [countdown,     setCountdown]     = useState(0);
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
            const { data } = await api.sendPasswordChangeOtp(); // reuses same OTP endpoint
            setMaskedMobile(data.mobile || '');
            setStep('otp_sent');
            setCountdown(60);
            toast.success('OTP sent to your mobile number.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not send OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) return toast.error('Enter the OTP.');
        setLoading(true);
        try {
            const { data } = await api.verifyPasswordChangeOtp({ otp: otp.trim() });
            setVerifiedToken(data.verifiedToken);
            setOtp('');
            setStep('otp_verified');
            toast.success('OTP verified. Type DELETE to confirm.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Incorrect OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (confirmText !== 'DELETE') return toast.error('Please type DELETE exactly.');
        setLoading(true);
        try {
            await api.deleteAccountPermanently({ verifiedToken, confirmText });
            toast.success('Your account has been deleted.');
            localStorage.clear();
            setTimeout(() => navigate('/register'), 1500);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete account.');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setOpen(false); setStep('confirm');
        setOtp(''); setConfirmText(''); setVerifiedToken('');
    };

    return (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert size={16} className="text-red-600" />
                    </div>
                    <div>
                        <p className="font-bold text-red-700 text-sm">Delete Account Permanently</p>
                        <p className="text-xs text-gray-400 mt-0.5">This cannot be undone</p>
                    </div>
                </div>
                <ChevronRight size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>

            {open && (
                <div className="px-5 pb-5 border-t border-red-50 pt-4 space-y-4">
                    {step === 'confirm' && (
                        <>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
                                <p className="font-bold flex items-center gap-2"><AlertTriangle size={14} /> Warning — this is permanent</p>
                                <p>• Your profile, bookings, ratings and all data will be deleted forever.</p>
                                <p>• You will not be able to recover your account.</p>
                                <p>• Any active job bookings will be cancelled.</p>
                            </div>
                            <p className="text-sm text-gray-600">We will send an OTP to your registered mobile number to verify your identity before deleting.</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSendOtp}
                                    disabled={loading}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
                                    Send OTP to Verify
                                </button>
                                <button onClick={reset} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'otp_sent' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                                OTP sent to mobile ending in <strong>{maskedMobile?.slice(-4)}</strong>.
                            </p>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Enter OTP</label>
                                <input
                                    type="number"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                    placeholder="6-digit code"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-xl font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-red-300"
                                />
                            </div>
                            <button
                                onClick={handleVerifyOtp}
                                disabled={loading || !otp.trim()}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Verify OTP'}
                            </button>
                            <div className="flex items-center justify-between text-xs">
                                {countdown > 0
                                    ? <span className="text-gray-400">Resend in {countdown}s</span>
                                    : <button onClick={handleSendOtp} disabled={loading} className="text-red-500 underline font-semibold">Resend OTP</button>}
                                <button onClick={reset} className="text-gray-400">Cancel</button>
                            </div>
                        </div>
                    )}

                    {step === 'otp_verified' && (
                        <div className="space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-semibold flex items-center gap-2">
                                <AlertTriangle size={14} /> Last step — type DELETE to confirm
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Type <span className="font-black text-red-600">DELETE</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder="Type DELETE here"
                                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 font-bold tracking-wide ${
                                        confirmText && confirmText !== 'DELETE' ? 'border-red-300' : 'border-gray-200'
                                    }`}
                                />
                            </div>
                            <button
                                onClick={handleDelete}
                                disabled={loading || confirmText !== 'DELETE'}
                                className="w-full py-3 bg-red-700 hover:bg-red-800 text-white rounded-xl text-sm font-black disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                                DELETE MY ACCOUNT PERMANENTLY
                            </button>
                            <button onClick={reset} className="w-full text-center text-xs text-gray-400 hover:text-gray-600">
                                Cancel — keep my account
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY TOGGLE
// ─────────────────────────────────────────────────────────────────────────────
function AvailabilitySection({ profile }) {
    const [available, setAvailable] = useState(profile?.availability ?? true);
    const [loading,   setLoading]   = useState(false);

    const toggle = async () => {
        setLoading(true);
        try {
            const { data } = await api.toggleAvailability({ available: !available });
            setAvailable(data.availability);
            toast.success(data.availability ? 'You are now available for jobs.' : 'You are now set as unavailable.');
        } catch {
            toast.error('Could not update availability.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${available ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {available
                        ? <ToggleRight size={18} className="text-green-600" />
                        : <ToggleLeft  size={18} className="text-gray-400" />}
                </div>
                <div>
                    <p className="font-bold text-gray-900 text-sm">Available for Work</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {available ? 'You appear in client searches' : 'Hidden from client searches'}
                    </p>
                </div>
            </div>
            <button
                onClick={toggle}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${available ? 'bg-green-500' : 'bg-gray-300'}`}
            >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${available ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PREFERENCES
// ─────────────────────────────────────────────────────────────────────────────
function NotificationSection() {
    const [prefs, setPrefs] = useState({
        jobAlerts:    true,
        smsUpdates:   true,
        ratingAlerts: true,
        groupAlerts:  true,
    });

    const toggle = (key) => {
        setPrefs(p => {
            const updated = { ...p, [key]: !p[key] };
            // Persist to localStorage as a simple preference store
            localStorage.setItem('notifPrefs', JSON.stringify(updated));
            return updated;
        });
        toast.success('Preference saved.');
    };

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('notifPrefs') || '{}');
            setPrefs(p => ({ ...p, ...saved }));
        } catch {}
    }, []);

    const items = [
        { key: 'jobAlerts',    label: 'New job alerts',        sub: 'When matching jobs are posted' },
        { key: 'smsUpdates',   label: 'SMS notifications',     sub: 'Status updates via SMS' },
        { key: 'ratingAlerts', label: 'Rating notifications',   sub: 'When a client rates your work' },
        { key: 'groupAlerts',  label: 'Group job alerts',       sub: 'Group job invitations' },
    ];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bell size={16} className="text-blue-600" />
                </div>
                <p className="font-bold text-gray-900 text-sm">Notification Preferences</p>
            </div>
            <div className="divide-y divide-gray-50">
                {items.map(({ key, label, sub }) => (
                    <div key={key} className="flex items-center justify-between px-5 py-3.5">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">{label}</p>
                            <p className="text-xs text-gray-400">{sub}</p>
                        </div>
                        <button
                            onClick={() => toggle(key)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${prefs[key] ? 'bg-orange-500' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${prefs[key] ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT INFO
// ─────────────────────────────────────────────────────────────────────────────
function AccountInfoSection({ profile }) {
    if (!profile) return null;
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-orange-600" />
                </div>
                <p className="font-bold text-gray-900 text-sm">Account Info</p>
            </div>
            <div className="px-5 py-4 space-y-3">
                {[
                    { label: 'Name',       value: profile.name },
                    { label: 'Karigar ID', value: profile.karigarId },
                    { label: 'Mobile',     value: `xxxxxx${profile.mobile?.slice(-4) || ''}` },
                    { label: 'Status',     value: profile.verificationStatus },
                    { label: 'Joined',     value: profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</span>
                        <span className="text-sm font-semibold text-gray-800 capitalize">{value || '—'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP INFO
// ─────────────────────────────────────────────────────────────────────────────
function AppInfoSection() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Info size={16} className="text-gray-600" />
                </div>
                <p className="font-bold text-gray-900 text-sm">About KarigarConnect</p>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                    <span className="text-gray-400 text-xs font-semibold uppercase">Version</span>
                    <span className="font-semibold">2.2.0</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400 text-xs font-semibold uppercase">Platform</span>
                    <span className="font-semibold">Worker App</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400 text-xs font-semibold uppercase">Support</span>
                    <span className="font-semibold text-orange-600">Use Help & Complaints</span>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SETTINGS PAGE
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
            } catch {
                // Profile load failure is non-critical for settings
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        toast.success('Logged out.');
        navigate('/login');
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-black text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage your account, password, and preferences</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-orange-400" size={28} />
                </div>
            ) : (
                <div className="space-y-4">

                    {/* Account Info */}
                    <AccountInfoSection profile={profile} />

                    {/* Availability */}
                    {profile && <AvailabilitySection profile={profile} />}

                    {/* Notifications */}
                    <NotificationSection />

                    {/* Change Password */}
                    <ChangePasswordSection />

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="w-full bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
                    >
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                            <LogOut size={16} className="text-gray-500 group-hover:text-orange-600 transition-colors" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-gray-900 text-sm">Log Out</p>
                            <p className="text-xs text-gray-400">Sign out of your account</p>
                        </div>
                        <ChevronRight size={16} className="ml-auto text-gray-300" />
                    </button>

                    {/* Delete Account — at the very bottom */}
                    <DeleteAccountSection />

                    {/* App info */}
                    <AppInfoSection />
                </div>
            )}
        </div>
    );
};

export default Settings;