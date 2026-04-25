import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, ArrowLeft, Shield, CheckCircle, Sparkles, 
  Clock, AlertCircle, Key, Phone, Lock, Smartphone,
  Send, Loader2, User, Heart, ThumbsUp, Crown, Diamond
} from 'lucide-react';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [isSent, setIsSent] = useState(false);
    const [focused, setFocused] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        if (!token || !role) return;

        if (role === 'client') navigate('/client/settings', { replace: true });
        else if (role === 'worker') navigate('/worker/settings', { replace: true });
        else if (role === 'admin') navigate('/admin/dashboard', { replace: true });
    }, [navigate]);

    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const value = identifier.trim();
        if (!value) return toast.error('Enter your registered mobile number or email.');

        const payload = /^\d{10}$/.test(value) ? { mobile: value } : { email: value };
        const toastId = toast.loading('Sending reset link...');
        try {
            await api.forgotPassword(payload);
            toast.success('Password reset instructions sent.', { id: toastId });
            setIsSent(true);
            setResendTimer(60);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send link', { id: toastId });
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        const value = identifier.trim();
        if (!value) return toast.error('Enter your registered mobile number or email.');
        
        const payload = /^\d{10}$/.test(value) ? { mobile: value } : { email: value };
        const toastId = toast.loading('Sending reset link...');
        try {
            await api.forgotPassword(payload);
            toast.success('Reset link resent successfully.', { id: toastId });
            setResendTimer(60);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send link', { id: toastId });
        }
    };

    const isMobile = /^\d{10}$/.test(identifier);
    const isEmail = identifier.includes('@') && identifier.includes('.');

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center p-4">
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="max-w-5xl w-full flex flex-col md:flex-row bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
                
                {/* Left side - Premium Illustration */}
                <div className="hidden md:flex md:w-2/5 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-500 p-8 flex-col justify-center items-center text-white relative overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16" />
                    <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
                    
                    <div className="relative z-10 text-center">
                        <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.1 }}
                            className="bg-white/20 backdrop-blur p-5 rounded-2xl mb-6 inline-block shadow-lg"
                        >
                            <Shield size="48" className="text-white animate-pulse" />
                        </motion.div>
                        
                        <h2 className="text-2xl font-bold mb-2">Secure Account Recovery</h2>
                        <p className="text-orange-100 text-sm">Reset your password quickly and securely</p>
                    </div>
                    
                    {/* Illustration Card */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full max-w-xs mt-8"
                    >
                        <div className="bg-white/20 backdrop-blur rounded-2xl p-6 shadow-xl">
                            <div className="bg-white rounded-xl p-5 shadow-lg">
                                <div className="flex justify-center mb-4">
                                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-3 rounded-full shadow-md">
                                        <Mail size="24" className="text-white" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 bg-gradient-to-r from-orange-200 to-amber-200 rounded-full animate-pulse"></div>
                                    <div className="h-3 bg-gradient-to-r from-orange-200 to-amber-200 rounded-full w-3/4 mx-auto"></div>
                                    <div className="h-3 bg-gradient-to-r from-orange-200 to-amber-200 rounded-full w-1/2 mx-auto"></div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    
                    <div className="mt-8 text-orange-100 text-xs text-center">
                        <p>🔒 Your security is our top priority</p>
                    </div>
                </div>

                {/* Right side - Form */}
                <div className="w-full md:w-3/5 p-6 sm:p-8">
                    <Link 
                        to="/login" 
                        className="inline-flex items-center text-sm text-orange-600 hover:text-orange-700 font-semibold transition-all group mb-6"
                    >
                        <ArrowLeft size="16" className="mr-2 group-hover:-translate-x-1 transition-transform" />
                        Back to Login
                    </Link>

                    <AnimatePresence mode="wait">
                        {isSent ? (
                            <motion.div 
                                key="success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="text-center py-4"
                            >
                                <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', delay: 0.1 }}
                                    className="flex justify-center mb-6"
                                >
                                    <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-4 rounded-full shadow-lg">
                                        <CheckCircle size="48" className="text-white" />
                                    </div>
                                </motion.div>
                                
                                <h3 className="text-2xl font-bold text-gray-800 mb-2">Check Your Inbox!</h3>
                                <p className="text-gray-600 text-sm mb-4">
                                    We've sent password reset instructions to <br />
                                    <span className="font-bold text-orange-600 text-base">{identifier}</span>
                                </p>
                                
                                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200 mb-5">
                                    <div className="flex items-start gap-2">
                                        <Clock size="16" className="text-orange-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-orange-800 text-left">
                                            <strong>Note:</strong> The reset link will expire in <span className="font-bold">1 hour</span> for security reasons.
                                        </p>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={handleResend}
                                    disabled={resendTimer > 0}
                                    className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size="14" />
                                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend email'}
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="text-center mb-6">
                                    <motion.div 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', delay: 0.1 }}
                                        className="bg-gradient-to-r from-orange-500 to-amber-500 p-3 rounded-full inline-flex items-center justify-center mb-4 shadow-lg"
                                    >
                                        <Key size="28" className="text-white" />
                                    </motion.div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Forgot Password?</h2>
                                    <p className="text-gray-500 text-sm">
                                        No worries! Enter your registered mobile number or email
                                    </p>
                                </div>
                                
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label htmlFor="identifier" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                                            Mobile Number or Email
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                {focused ? (
                                                    <Mail size="18" className="text-orange-500 transition-colors" />
                                                ) : (
                                                    <Mail size="18" className="text-gray-400 transition-colors" />
                                                )}
                                            </div>
                                            <input 
                                                type="text" 
                                                name="identifier" 
                                                value={identifier} 
                                                onChange={(e) => setIdentifier(e.target.value)} 
                                                onFocus={() => setFocused(true)}
                                                onBlur={() => setFocused(false)}
                                                required 
                                                placeholder="10-digit mobile or your.email@example.com"
                                                className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:bg-white transition-all outline-none"
                                            />
                                        </div>
                                        
                                        {/* Input validation hints */}
                                        <AnimatePresence>
                                            {identifier && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    className="mt-2 text-xs"
                                                >
                                                    {isMobile ? (
                                                        <span className="text-green-600 flex items-center gap-1">
                                                            <CheckCircle size="10" /> Valid mobile number
                                                        </span>
                                                    ) : isEmail ? (
                                                        <span className="text-green-600 flex items-center gap-1">
                                                            <CheckCircle size="10" /> Valid email format
                                                        </span>
                                                    ) : identifier.length > 0 ? (
                                                        <span className="text-amber-600 flex items-center gap-1">
                                                            <AlertCircle size="10" /> Enter a valid mobile number or email
                                                        </span>
                                                    ) : null}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    
                                    <motion.button 
                                        whileTap={{ scale: 0.98 }}
                                        type="submit" 
                                        className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 group"
                                    >
                                        <Send size="16" className="group-hover:translate-x-1 transition-transform" />
                                        Send Reset Link
                                    </motion.button>
                                </form>
                                
                                {/* Tips Section */}
                                <div className="mt-8 bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1.5 bg-orange-100 rounded-lg flex-shrink-0">
                                            <Shield size="14" className="text-orange-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-orange-800 text-sm flex items-center gap-1">
                                                <Sparkles size="12" /> Important Notes
                                            </h4>
                                            <ul className="text-xs text-orange-700 mt-2 space-y-1">
                                                <li className="flex items-start gap-1.5">
                                                    <CheckCircle size="10" className="flex-shrink-0 mt-0.5" />
                                                    <span>Use the email/phone associated with your KarigarConnect account</span>
                                                </li>
                                                <li className="flex items-start gap-1.5">
                                                    <CheckCircle size="10" className="flex-shrink-0 mt-0.5" />
                                                    <span>Check your spam folder if you don't receive the email</span>
                                                </li>
                                                <li className="flex items-start gap-1.5">
                                                    <CheckCircle size="10" className="flex-shrink-0 mt-0.5" />
                                                    <span>Reset link expires in 1 hour for security</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;