import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Shield, Lock, CheckCircle, ArrowRight, Home, Sparkles } from 'lucide-react';
import { PASSWORD_POLICY_TEXT, getPasswordStrength, isStrongPassword } from '../../constants/passwordPolicy';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { token } = useParams();
    const navigate = useNavigate();
    const strength = getPasswordStrength(password);
    const passwordsMatch = password && confirmPassword && password === confirmPassword;
    const isFormValid = isStrongPassword(password) && passwordsMatch;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return toast.error("Passwords do not match.");
        }
        if (!isStrongPassword(password)) {
            return toast.error(PASSWORD_POLICY_TEXT);
        }
        
        const toastId = toast.loading('Resetting password...');
        try {
            await api.resetPassword(token, { password });
            toast.success('Password has been reset successfully!', { id: toastId });
            navigate('/login');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password.', { id: toastId });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Back to Home Link */}
                <Link to="/" className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-semibold mb-4 group">
                    <Home size="16" className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
                >
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
                        
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <Shield size="28" className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Set New Password</h2>
                            <p className="text-orange-100 text-sm">Create a strong password to secure your account</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* New Password Field */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                                New Password
                            </label>
                            <div className="relative group">
                                <Lock size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                <input 
                                    type={showPassword ? 'text' : 'password'} 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    required 
                                    className="w-full pl-9 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all duration-200 bg-gray-50 focus:bg-white"
                                    placeholder="Enter your new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size="16" /> : <Eye size="16" />}
                                </button>
                            </div>
                            
                            {/* Password Strength Meter */}
                            {password && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-2 space-y-1"
                                >
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: strength.width }}
                                            transition={{ duration: 0.3 }}
                                            className={`h-full ${strength.color} transition-all duration-300`} 
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className={`text-xs font-medium ${strength.text}`}>Strength: {strength.label}</p>
                                        <p className="text-xs text-gray-400">{Math.round(parseFloat(strength.width))}%</p>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">{PASSWORD_POLICY_TEXT}</p>
                                </motion.div>
                            )}
                        </div>
                        
                        {/* Confirm Password Field */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Confirm New Password
                            </label>
                            <div className="relative group">
                                <Lock size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                <input 
                                    type={showConfirmPassword ? 'text' : 'password'} 
                                    value={confirmPassword} 
                                    onChange={(e) => setConfirmPassword(e.target.value)} 
                                    required 
                                    className="w-full pl-9 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all duration-200 bg-gray-50 focus:bg-white"
                                    placeholder="Confirm your new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff size="16" /> : <Eye size="16" />}
                                </button>
                            </div>
                            
                            {/* Password Match Indicator */}
                            <AnimatePresence>
                                {confirmPassword && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mt-1"
                                    >
                                        {passwordsMatch ? (
                                            <p className="text-xs text-green-600 flex items-center gap-1">
                                                <CheckCircle size="12" /> Passwords match
                                            </p>
                                        ) : (
                                            <p className="text-xs text-red-500 flex items-center gap-1">
                                                <AlertCircle size="12" /> Passwords do not match
                                            </p>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        
                        {/* Submit Button */}
                        <motion.button 
                            whileTap={{ scale: 0.98 }}
                            type="submit" 
                            disabled={!isFormValid}
                            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-md hover:shadow-lg transform transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                        >
                            <Shield size="16" className="group-hover:scale-110 transition-transform" />
                            Reset Password
                            <ArrowRight size="14" className="group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                        
                        {/* Login Link */}
                        <div className="text-center pt-2">
                            <p className="text-sm text-gray-600">
                                Remember your password?{' '}
                                <Link to="/login" className="font-bold text-orange-600 hover:text-orange-700 transition-colors">
                                    Login here
                                </Link>
                            </p>
                        </div>
                    </form>
                </motion.div>

                {/* Security Tips */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                            <Shield size="14" className="text-blue-600" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-blue-800">Password Security Tips</h4>
                            <ul className="text-xs text-blue-700 mt-2 space-y-1">
                                <li className="flex items-center gap-1.5">
                                    <CheckCircle size="10" /> Use at least 8 characters
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <CheckCircle size="10" /> Include uppercase and lowercase letters
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <CheckCircle size="10" /> Add numbers and special characters
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <CheckCircle size="10" /> Avoid common words or personal information
                                </li>
                            </ul>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

// Helper AlertCircle Component
const AlertCircle = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

export default ResetPassword;