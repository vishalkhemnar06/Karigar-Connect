import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return toast.error("Passwords do not match.");
        }
        if (password.length < 6) {
            return toast.error("Password must be at least 6 characters long.");
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
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-orange-200">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-center">
                    <h2 className="text-3xl font-bold text-white mb-2">Set New Password</h2>
                    <p className="text-orange-100 text-sm">Create a strong password to secure your account</p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">New Password</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            className="w-full px-4 py-3 border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                            placeholder="Enter your new password"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Confirm New Password</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                            className="w-full px-4 py-3 border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                            placeholder="Confirm your new password"
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                    >
                        Reset Password
                    </button>
                    
                    <div className="text-center pt-4">
                        
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;