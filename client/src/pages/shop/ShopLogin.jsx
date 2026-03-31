// client/src/pages/shop/ShopLogin.jsx
import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Store, Phone, Lock, LogIn, Eye, EyeOff } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

const TextInput = ({ label, type, placeholder, value, onChange, required, maxLength, prefix, rightSlot, autoComplete = 'off', name, inputMode }) => (
    <div className="space-y-1.5">
        {label && (
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {label}
            </label>
        )}
        <div className="relative flex items-center">
            {prefix && (
                <span className="absolute left-3 text-gray-400 text-sm font-medium select-none pointer-events-none">
                    {prefix}
                </span>
            )}
            <input
                type={type || 'text'}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
                maxLength={maxLength}
                autoComplete={autoComplete}
                inputMode={inputMode}
                className={`w-full border-2 border-gray-200 rounded-lg py-3 bg-orange-50 text-gray-900
                    placeholder-gray-300 text-sm font-medium
                    focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none focus:bg-white
                    transition-all duration-200 ${prefix ? 'pl-10' : 'pl-4'} pr-3`}
            />
            {rightSlot && <div className="absolute right-3">{rightSlot}</div>}
        </div>
    </div>
);

const MethodToggle = ({ method, onChange }) => (
    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {['password', 'otp'].map(m => (
            <button
                key={m}
                type="button"
                onClick={() => onChange(m)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all
                    ${method === m
                        ? 'bg-white shadow text-orange-700 border border-orange-100'
                        : 'text-gray-500 hover:text-orange-600'
                    }`}
            >
                {m === 'password' ? '🔑 Password' : '📱 OTP'}
            </button>
        ))}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Shop Login Component
// ─────────────────────────────────────────────────────────────────────────────

const ShopLogin = () => {
    const navigate = useNavigate();
    const [method, setMethod] = useState('password');
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const onMobileChange = useCallback(e => setMobile(e.target.value), []);
    const onPasswordChange = useCallback(e => setPassword(e.target.value), []);
    const onOtpChange = useCallback(e => setOtp(e.target.value), []);
    const togglePassword = useCallback(() => setShowPassword(v => !v), []);
    const handleMethodChange = useCallback(m => setMethod(m), []);

    const sendOtp = useCallback(async () => {
        if (!mobile || mobile.length !== 10) {
            return toast.error('Enter a valid 10-digit mobile number');
        }
        setLoading(true);
        try {
            // Try login OTP first (for existing shops)
            await api.shopSendLoginOtp({ mobile });
            setOtpSent(true);
            toast.success('OTP sent to your mobile!');
        } catch (err) {
            const errMsg = err.response?.data?.message;
            if (err.response?.data?.notRegistered) {
                toast.error('This mobile is not registered. Please register first.');
            } else {
                toast.error(errMsg || 'Failed to send OTP');
            }
        } finally {
            setLoading(false);
        }
    }, [mobile]);

    const handleLogin = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let response;
            if (method === 'password') {
                response = await api.shopLogin({ mobile, password });
            } else {
                // Use login OTP verification
                response = await api.shopVerifyLoginOtp({ mobile, otp });
            }
            const { data } = response;
            localStorage.setItem('shopToken', data.token);
            localStorage.setItem('shopRole', 'shop');
            localStorage.setItem('shop', JSON.stringify(data.shop));
            toast.success('Login successful!');
            navigate('/shop/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    }, [mobile, password, otp, method, navigate]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-orange-100 px-4 py-2 rounded-full mb-3">
                        <Store size={20} className="text-orange-600" />
                        <span className="font-bold text-orange-700">Shop Portal</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Shop Owner Login</h1>
                    <p className="text-gray-500 text-sm">Manage your shop on KarigarConnect</p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleLogin} className="space-y-5" autoComplete="off">
                        {/* Mobile Input */}
                        <TextInput
                            label="Mobile Number"
                            type="tel"
                            placeholder="Registered mobile"
                            value={mobile}
                            onChange={onMobileChange}
                            required
                            maxLength={10}
                            prefix="+91"
                            name="shop_mobile"
                            autoComplete="off"
                            inputMode="numeric"
                        />

                        {/* Method Toggle */}
                        <MethodToggle method={method} onChange={handleMethodChange} />

                        {/* Password Method */}
                        {method === 'password' ? (
                            <TextInput
                                label="Password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={password}
                                onChange={onPasswordChange}
                                required
                                name="shop_password"
                                autoComplete="new-password"
                                rightSlot={
                                    <button
                                        type="button"
                                        onClick={togglePassword}
                                        className="text-gray-400 hover:text-gray-700 p-1"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                }
                            />
                        ) : (
                            /* OTP Method */
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <TextInput
                                        label="OTP"
                                        type="text"
                                        placeholder="6-digit OTP"
                                        value={otp}
                                        onChange={onOtpChange}
                                        required
                                        maxLength={6}
                                        name="shop_otp"
                                        autoComplete="one-time-code"
                                        inputMode="numeric"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={sendOtp}
                                    disabled={loading}
                                    className="shrink-0 px-4 py-3.5 bg-orange-100 hover:bg-orange-200 text-orange-700
                                        rounded-lg text-xs font-bold border border-orange-200 disabled:opacity-50
                                        transition-all whitespace-nowrap"
                                >
                                    {otpSent ? 'Resend' : 'Send'}
                                </button>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3.5 rounded-xl font-bold
                                flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:-translate-y-0.5
                                active:translate-y-0 transition-all duration-200"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Logging in...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    <span>Login to Dashboard</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Register Link */}
                    <p className="text-center text-sm text-gray-500 mt-5">
                        New shop?{' '}
                        <Link to="/shop/register" className="text-orange-600 font-bold hover:underline">
                            Register here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShopLogin;