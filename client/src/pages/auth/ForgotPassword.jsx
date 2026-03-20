import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, Shield, CheckCircle } from 'lucide-react';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isSent, setIsSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const toastId = toast.loading('Sending reset link...');
        try {
            await api.forgotPassword({ email });
            toast.success('Password reset link sent to your email!', { id: toastId });
            setIsSent(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send link', { id: toastId });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-white flex items-center justify-center p-4">
            <div className="max-w-4xl w-full flex flex-col md:flex-row bg-white rounded-2xl shadow-xl overflow-hidden border border-orange-200">
                {/* Left side - Illustration */}
                <div className="hidden md:flex md:w-2/5 bg-gradient-to-b from-orange-500 to-amber-500 p-8 flex-col justify-center items-center text-white">
                    <div className="mb-8 text-center">
                        <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm mb-6">
                            <Shield size={48} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Secure Account Access</h2>
                        <p className="text-orange-100">Recover your account quickly and securely</p>
                    </div>
                    
                    {/* Illustration */}
                    <div className="w-full max-w-xs">
                        <div className="bg-white/20 rounded-2xl p-6 backdrop-blur-sm">
                            <div className="bg-white rounded-xl p-4 shadow-lg">
                                <div className="flex justify-center mb-4">
                                    <div className="bg-orange-100 p-3 rounded-full">
                                        <Mail size={24} className="text-orange-600" />
                                    </div>
                                </div>
                                <div className="h-4 bg-orange-200 rounded-full mb-2"></div>
                                <div className="h-4 bg-orange-200 rounded-full w-3/4 mx-auto"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 text-orange-100 text-sm">
                        <p>Your security is our priority</p>
                    </div>
                </div>

                {/* Right side - Form */}
                <div className="w-full md:w-3/5 p-8">
                    <Link 
                        to="/login" 
                        className="inline-flex items-center text-sm text-orange-600 hover:text-orange-800 font-medium transition-colors mb-6"
                    >
                        <ArrowLeft size={16} className="mr-2" />
                        Back to Login
                    </Link>

                    {isSent ? (
                        <div className="text-center py-8">
                            <div className="flex justify-center mb-6">
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-3 rounded-full">
                                    <CheckCircle size={48} className="text-white" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">Check Your Email</h3>
                            <p className="text-gray-600 mb-6">
                                We've sent a password reset link to <span className="font-semibold text-orange-600">{email}</span>. 
                                Please check your inbox (and spam folder) to reset your password.
                            </p>
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-6">
                                <p className="text-sm text-orange-800">
                                    <strong>Note:</strong> The reset link will expire in 1 hour for security reasons.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsSent(false)}
                                className="text-orange-600 hover:text-orange-800 font-medium underline underline-offset-2 transition-colors"
                            >
                                Resend email
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-3 rounded-full inline-flex items-center justify-center mb-4">
                                    <Shield size={32} className="text-white" />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-800 mb-2">Forgot Password?</h2>
                                <p className="text-gray-600">
                                    No worries! Enter your email and we'll send you a secure reset link.
                                </p>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail size={18} className="text-orange-500" />
                                        </div>
                                        <input 
                                            type="email" 
                                            name="email" 
                                            value={email} 
                                            onChange={(e) => setEmail(e.target.value)} 
                                            required 
                                            placeholder="your.email@example.com"
                                            className="w-full pl-10 pr-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-gray-800 placeholder-orange-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                                        />
                                    </div>
                                </div>
                                
                                <button 
                                    type="submit" 
                                    className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg shadow-md hover:from-orange-600 hover:to-amber-600 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                                >
                                    Send Reset Link
                                </button>
                            </form>
                            
                            <div className="mt-8 bg-orange-50 p-4 rounded-lg border border-orange-200">
                                <h4 className="font-semibold text-orange-800 mb-2 flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    Important
                                </h4>
                                <p className="text-sm text-orange-700">
                                    You must use the email address associated with your KarigarConnect account. 
                                    If you don't receive the email within a few minutes, please check your spam folder.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;