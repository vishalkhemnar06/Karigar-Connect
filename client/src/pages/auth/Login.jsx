import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';

const Login = () => {
    const [loginMethod, setLoginMethod] = useState('password');
    const [role, setRole] = useState('worker');
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    // Role-based images for the main display
    const roleImages = {
        worker: "https://thumbs.dreamstime.com/b/workers-group-people-tools-car-mechanic-painter-handyman-79544094.jpg",
        client: "https://www.shutterstock.com/image-photo/professional-mature-business-woman-manager-600nw-2424450135.jpg",
        admin: "https://images.unsplash.com/photo-1568992687947-868a62a9f521?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1032&q=80"
    };

    // Role-based small icons
    const roleIcons = {
        worker: "https://static.thenounproject.com/png/215121-200.png",
        client: "https://png.pngtree.com/png-clipart/20231220/original/pngtree-customer-icon-client-intensive-red-photo-png-image_13895659.png",
        admin: "https://www.pngmart.com/files/21/Admin-Profile-Vector-PNG-Photo.png"
    };

    // Role-based gradients
    const roleGradients = {
        worker: "from-orange-500 to-orange-600",
        client: "from-orange-500 to-amber-500",
        admin: "from-amber-500 to-orange-700"
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        if (newRole === 'admin') {
            setLoginMethod('password');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const toastId = toast.loading('Logging in...');
        try {
            let data;
            if (loginMethod === 'password') {
                const response = await api.loginWithPassword({ role, mobile, password });
                data = response.data;
            } else {
                const response = await api.loginWithOtp({ role, mobile, otp });
                data = response.data;
            }
           
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.user.role);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success('Login Successful!', { id: toastId });

            if (data.user.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (data.user.role === 'worker') {
                navigate('/worker/dashboard');
            } else {
                navigate('/client/dashboard');
            }

        } catch (error) {
            toast.error(error.response?.data?.message || 'Login Failed', { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };
   
    const handleSendOtp = async () => {
        if (!mobile || mobile.length !== 10) return toast.error('Please enter a valid 10-digit mobile number');
        setIsLoading(true);
        const toastId = toast.loading('Sending OTP...');
        try {
            await api.sendOtp({ mobile });
            setOtpSent(true);
            toast.success('OTP sent to your mobile!', { id: toastId });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send OTP', { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-orange-50 via-white to-orange-100">
            {/* Left side - Form */}
            <div className="w-full lg:w-2/5 flex items-center justify-center p-4 lg:p-8">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-orange-200">
                    {/* Form header with gradient based on role */}
                    <div className={`bg-gradient-to-r ${roleGradients[role]} py-6 px-8 text-center relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-white/20"></div>
                        <div className="relative z-10 flex items-center justify-center">
                            <img
                                src={roleIcons[role]}
                                alt={role}
                                className="w-12 h-12 mr-3 filter brightness-0 invert"
                            />
                            <div>
                                <h1 className="text-3xl font-bold text-white drop-shadow-md">Welcome Back</h1>
                                <p className="text-white/90 mt-1">Login to your KarigarConnect account</p>
                            </div>
                        </div>
                    </div>
                   
                    <div className="p-8">
                        <form onSubmit={handleLogin} className="space-y-6">
                            {/* Role Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">I am a</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['worker', 'client', 'admin'].map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => handleRoleChange(r)}
                                            className={`py-3 px-2 rounded-xl border text-sm font-medium transition-all duration-300 transform flex flex-col items-center ${
                                                role === r
                                                    ? `bg-gradient-to-b ${roleGradients[r]} border-orange-300 text-white scale-105 shadow-lg`
                                                    : 'bg-white border-orange-200 text-gray-700 hover:bg-orange-50'
                                            }`}
                                        >
                                            <img
                                                src={roleIcons[r]}
                                                alt={r}
                                                className="w-6 h-6 mb-1 filter brightness-0 opacity-100"
                                            />
                                            {r.charAt(0).toUpperCase() + r.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mobile Input with Send OTP Button */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                                <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500">+91</span>
                                        </div>
                                        <input
                                            type="tel"
                                            placeholder="Enter your registered mobile number"
                                            value={mobile}
                                            onChange={(e) => setMobile(e.target.value)}
                                            required
                                            className="block w-full pl-12 pr-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-gray-800 placeholder-orange-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                                            maxLength="10"
                                        />
                                    </div>
                                    {loginMethod === 'otp' && (
                                        <button
                                            type="button"
                                            onClick={handleSendOtp}
                                            disabled={isLoading || !mobile || mobile.length !== 10}
                                            className="px-4 py-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 hover:text-orange-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap border border-orange-200 font-medium sm:w-auto"
                                        >
                                            {otpSent ? 'Resend OTP' : 'Send OTP'}
                                        </button>
                                    )}
                                </div>
                            </div>
                           
                            {/* Login Method Toggle */}
                            {role !== 'admin' && (
                                <div className="flex bg-orange-100 rounded-xl p-1">
                                    <button
                                        type="button"
                                        onClick={() => setLoginMethod('password')}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                            loginMethod === 'password'
                                                ? 'bg-white text-orange-700 shadow-md border border-orange-200'
                                                : 'text-orange-600 hover:text-orange-800'
                                        }`}
                                    >
                                        Password
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLoginMethod('otp')}
                                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                            loginMethod === 'otp'
                                                ? 'bg-white text-orange-700 shadow-md border border-orange-200'
                                                : 'text-orange-600 hover:text-orange-800'
                                        }`}
                                    >
                                        OTP Login
                                    </button>
                                </div>
                            )}

                            {/* Password or OTP Input */}
                            {loginMethod === 'password' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="block w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-gray-800 placeholder-orange-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                                    />
                                    {role !== 'admin' && (
                                        <div className="text-right mt-2">
                                            <Link to="/forgot-password" className="text-sm text-orange-600 hover:text-orange-800 transition-colors">
                                                Forgot Password?
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">One-Time Password (OTP)</label>
                                    <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                                        <input
                                            type="text"
                                            placeholder="Enter 6-digit OTP"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            required
                                            className="block flex-1 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-gray-800 placeholder-orange-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                                            maxLength="6"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap border border-orange-500 font-medium sm:w-auto"
                                        >
                                            Verify OTP
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Login Button (only show for password login) */}
                            {loginMethod === 'password' && (
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`w-full bg-gradient-to-r ${roleGradients[role]} text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Logging in...
                                        </span>
                                    ) : (
                                        'Login to Account'
                                    )}
                                </button>
                            )}
                        </form>
                       
                        {/* Register Link */}
                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                Don't have an account?{' '}
                                <Link to="/register" className="font-bold text-orange-600 hover:text-orange-800 transition-colors">
                                    Register now
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side - Image based on role */}
            <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-l from-orange-100/80 via-transparent to-transparent z-10"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-orange-100/50 to-transparent z-10"></div>
                
                {/* Image container with improved styling */}
                <div className="w-full h-full flex items-center justify-center p-12">
                    <div className="relative w-full h-150 rounded-3xl overflow-hidden">
                        <img
                            src={roleImages[role]}
                            alt={role}
                            className="w-full h-full object-cover rounded-3xl"
                        />
                        
                        {/* Text overlay */}
                        <div className="absolute bottom-8 left-8 z-20 text-gray-800 max-w-md">
                            <h2 className="text-4xl font-bold mb-3 bg-white/80 backdrop-blur-sm p-4 rounded-xl">
                                {role === 'worker' && 'Skilled Workers Platform'}
                                {role === 'client' && 'Find Trusted Professionals'}
                                {role === 'admin' && 'Admin Management Portal'}
                            </h2>
                            <p className="text-xl bg-white/80 backdrop-blur-sm p-4 rounded-xl">
                                {role === 'worker' && 'Connect with clients and grow your business'}
                                {role === 'client' && 'Hire verified professionals for all your needs'}
                                {role === 'admin' && 'Manage the platform and ensure smooth operations'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;