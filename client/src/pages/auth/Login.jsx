// client/src/pages/auth/Login.jsx
// UPDATED:
//   - Shop owner login now on the SAME page (no separate route needed)
//   - Fixed input re-render bug (all sub-components defined OUTSIDE Login)
//   - Professional design with smooth role switching
//   - All original worker/client/admin logic preserved

import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Store, Eye, EyeOff, ArrowRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// STABLE sub-components — defined OUTSIDE Login component so they are never
// re-created on re-render, fixing the "must click input each time" bug.
// ─────────────────────────────────────────────────────────────────────────────

const TextInput = ({ label, type, placeholder, value, onChange,
    required, maxLength, prefix, rightSlot, autoComplete = 'off', name, inputMode }) => (
    <div className="space-y-1.5">
        {label && (
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">
                {label}
            </label>
        )}
        <div className="relative flex items-center">
            {prefix && (
                <span className="absolute left-4 text-gray-400 text-sm font-medium select-none pointer-events-none z-10">
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
                className={[
                    'w-full border-2 rounded-xl py-3.5 pr-12 bg-gray-50 text-gray-900',
                    'placeholder-gray-300 text-sm font-medium',
                    'focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none focus:bg-white',
                    'transition-all duration-200',
                    prefix ? 'pl-14' : 'pl-4',
                    'border-gray-200',
                ].join(' ')}
            />
            {rightSlot && (
                <div className="absolute right-3 z-10">{rightSlot}</div>
            )}
        </div>
    </div>
);

const MethodToggle = ({ method, onChange }) => (
    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {['password', 'otp'].map(m => (
            <button key={m} type="button" onClick={() => onChange(m)}
                className={[
                    'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                    method === m
                        ? 'bg-white shadow text-orange-700 border border-orange-100'
                        : 'text-gray-500 hover:text-orange-600',
                ].join(' ')}>
                {m === 'password' ? '🔑 Password' : '📱 OTP Login'}
            </button>
        ))}
    </div>
);

const SubmitBtn = ({ loading, gradient, children }) => (
    <button type="submit" disabled={loading}
        className={[
            'w-full bg-gradient-to-r text-white py-3.5 rounded-xl font-black text-sm',
            'hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2',
            gradient,
        ].join(' ')}>
        {loading ? (
            <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Logging in...</span>
            </>
        ) : children}
    </button>
);

// ── Standard login (worker / client / admin) ──────────────────────────────────
const StandardForm = ({ role, gradient, onSuccess }) => {
    const [method, setMethod]     = useState('password');
    const [mobile, setMobile]     = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd]   = useState(false);
    const [otp, setOtp]           = useState('');
    const [otpSent, setOtpSent]   = useState(false);
    const [loading, setLoading]   = useState(false);

    const onMobileChange   = useCallback(e => setMobile(e.target.value), []);
    const onPasswordChange = useCallback(e => setPassword(e.target.value), []);
    const onOtpChange      = useCallback(e => setOtp(e.target.value), []);
    const togglePwd        = useCallback(() => setShowPwd(v => !v), []);
    const handleMethodChange = useCallback(m => setMethod(m), []);

    const sendOtp = useCallback(async () => {
        if (!mobile || mobile.length !== 10) return toast.error('Enter valid 10-digit mobile.');
        setLoading(true);
        try {
            await api.sendOtp({ mobile });
            setOtpSent(true);
            toast.success('OTP sent to your mobile!');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to send OTP.');
        } finally { setLoading(false); }
    }, [mobile]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        const tid = toast.loading('Logging in...');
        try {
            const res = method === 'password'
                ? await api.loginWithPassword({ role, mobile, password })
                : await api.loginWithOtp({ role, mobile, otp });
            const { data } = res;
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.user.role);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success('Login successful!', { id: tid });
            onSuccess(data.user.role);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Login failed.', { id: tid });
        } finally { setLoading(false); }
    }, [role, mobile, password, otp, method, onSuccess]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <TextInput label="Mobile Number" type="tel" placeholder="10-digit mobile"
            value={mobile} onChange={onMobileChange} required maxLength={10} prefix="+91"
            name={`mobile_${role}`} autoComplete="off" inputMode="numeric" />

            {role !== 'admin' && <MethodToggle method={method} onChange={handleMethodChange} />}

            {method === 'password' ? (
                <>
                    <TextInput
                        label="Password" type={showPwd ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password} onChange={onPasswordChange} required
                        name={`login_${role}_password`}
                        autoComplete="new-password"
                        rightSlot={
                            <button type="button" onClick={togglePwd}
                                className="text-gray-400 hover:text-gray-700 p-1">
                                {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                            </button>
                        }
                    />
                    {role !== 'admin' && (
                        <div className="text-right -mt-2">
                            <Link to="/forgot-password"
                                className="text-xs text-orange-500 hover:text-orange-700 font-semibold">
                                Forgot Password?
                            </Link>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <TextInput label="OTP" type="text" placeholder="6-digit OTP"
                            value={otp} onChange={onOtpChange} required maxLength={6}
                            name={`otp_${role}`} autoComplete="one-time-code" inputMode="numeric" />
                    </div>
                    <button type="button" onClick={sendOtp} disabled={loading}
                        className="shrink-0 px-4 py-3.5 bg-orange-100 hover:bg-orange-200 text-orange-700
                            rounded-xl text-xs font-bold border border-orange-200 disabled:opacity-50 transition-all whitespace-nowrap">
                        {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                </div>
            )}

            <SubmitBtn loading={loading} gradient={`from-${gradient}-500 to-${gradient}-600`}>
                <span>Login to Account</span><ArrowRight size={15}/>
            </SubmitBtn>
        </form>
    );
};

// ── Shop owner login form ─────────────────────────────────────────────────────
const ShopForm = ({ onSuccess }) => {
    const [mobile, setMobile]     = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd]   = useState(false);
    const [loading, setLoading]   = useState(false);

    const onMobileChange   = useCallback(e => setMobile(e.target.value), []);
    const onPasswordChange = useCallback(e => setPassword(e.target.value), []);
    const togglePwd        = useCallback(() => setShowPwd(v => !v), []);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        const tid = toast.loading('Logging in...');
        try {
            const { data } = await api.shopLogin({ mobile, password });
            localStorage.setItem('shopToken', data.token);
            localStorage.setItem('shopRole', 'shop');
            localStorage.setItem('shop', JSON.stringify(data.shop));
            toast.success('Login successful!', { id: tid });
            onSuccess('shop');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Login failed.', { id: tid });
        } finally { setLoading(false); }
    }, [mobile, password, onSuccess]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <TextInput label="Registered Mobile" type="tel" placeholder="Shop mobile number"
                value={mobile} onChange={onMobileChange} required maxLength={10} prefix="+91"
                name="shop_mobile" autoComplete="off" inputMode="numeric" />
            <TextInput
                label="Password" type={showPwd ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password} onChange={onPasswordChange} required
                name="shop_login_password"
                autoComplete="new-password"
                rightSlot={
                    <button type="button" onClick={togglePwd}
                        className="text-gray-400 hover:text-gray-700 p-1">
                        {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                }
            />
            <SubmitBtn loading={loading} gradient="from-teal-500 to-emerald-600">
                <Store size={16}/><span>Login to Shop Dashboard</span>
            </SubmitBtn>
            <p className="text-center text-xs text-gray-500">
                New shop?{' '}
                <Link to="/shop/register" className="text-teal-600 font-bold hover:underline">
                    Register your shop
                </Link>
            </p>
        </form>
    );
};

// ── Role config ───────────────────────────────────────────────────────────────
const ROLES = [
    { key: 'worker', label: 'Karigar',  emoji: '🔨', color: 'orange',  headerGrad: 'from-orange-500 to-orange-600' },
    { key: 'client', label: 'Client',   emoji: '👤', color: 'amber',   headerGrad: 'from-amber-500 to-orange-500'  },
    { key: 'admin',  label: 'Admin',    emoji: '🛡️', color: 'gray',    headerGrad: 'from-gray-700 to-gray-900'     },
    { key: 'shop',   label: 'Shop',     emoji: null,  color: 'teal',    headerGrad: 'from-teal-500 to-emerald-600'  },
];

const IMAGES = {
    worker: 'https://thumbs.dreamstime.com/b/workers-group-people-tools-car-mechanic-painter-handyman-79544094.jpg',
    client: 'https://www.shutterstock.com/image-photo/professional-mature-business-woman-manager-600nw-2424450135.jpg',
    admin:  'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1032&q=80',
    shop:   'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1032&q=80',
};

const HEADLINES = {
    worker: ['Skilled Workers Platform',  'Connect with clients and grow your business'],
    client: ['Find Trusted Professionals','Hire verified professionals for all your needs'],
    admin:  ['Admin Management Portal',   'Manage the platform and ensure smooth operations'],
    shop:   ['Partner Shop Portal',       'Sell tools to verified workers with exclusive discounts'],
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const Login = () => {
    const navigate  = useNavigate();
    const [role, setRole] = useState('worker');

    const handleRoleChange = useCallback(key => setRole(key), []);
    const handleSuccess = useCallback(userRole => {
        const paths = { admin: '/admin/dashboard', worker: '/worker/dashboard', shop: '/shop/dashboard' };
        navigate(paths[userRole] || '/client/dashboard');
    }, [navigate]);

    const current = ROLES.find(r => r.key === role);
    const [hl, sub] = HEADLINES[role];

    return (
        <div className="min-h-screen flex bg-white">
            {/* ── LEFT ── */}
            <div className="w-full lg:w-[44%] flex flex-col justify-center px-6 py-10 lg:px-12 bg-gradient-to-br from-orange-50 to-white">
                {/* Brand */}
                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 bg-orange-100 px-3 py-1.5 rounded-full mb-4">
                        <span className="text-orange-600 text-xs font-black uppercase tracking-widest">KarigarConnect</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Welcome back 👋</h1>
                    <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
                </div>

                {/* Role selector */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    {ROLES.map(r => (
                        <button
                            key={r.key}
                            type="button"
                            onClick={() => handleRoleChange(r.key)}
                            className={[
                                'flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 text-[11px] font-black',
                                'transition-all duration-200 select-none',
                                role === r.key
                                    ? `bg-gradient-to-b ${r.headerGrad} border-transparent text-white shadow-lg scale-105`
                                    : 'bg-white border-gray-100 text-gray-500 hover:border-orange-200 hover:bg-orange-50',
                            ].join(' ')}>
                            {r.key === 'shop'
                                ? <Store size={18} className={role === r.key ? 'text-white' : 'text-teal-500'} />
                                : <span className="text-lg leading-none">{r.emoji}</span>
                            }
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* Form card */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className={`bg-gradient-to-r ${current.headerGrad} px-6 py-4`}>
                        <h2 className="text-white font-black text-base">
                            {role === 'shop' ? 'Shop Owner Login' :
                             role === 'admin' ? 'Admin Portal' :
                             role === 'worker' ? 'Karigar Login' : 'Client Login'}
                        </h2>
                        <p className="text-white/60 text-xs mt-0.5">
                            {role === 'shop' ? 'Access your shop dashboard' : 'Enter your credentials to continue'}
                        </p>
                    </div>
                    <div className="p-6">
                        {role === 'shop'
                            ? <ShopForm onSuccess={handleSuccess} />
                            : <StandardForm role={role} gradient={current.color} onSuccess={handleSuccess} />
                        }
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-5 text-center">
                    <p className="text-sm text-gray-600">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-bold text-orange-600 hover:text-orange-800">Register now</Link>
                    </p>
                </div>
            </div>

            {/* ── RIGHT ── */}
            <div className="hidden lg:block lg:flex-1 relative overflow-hidden">
                <img src={IMAGES[role]} alt={role}
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="relative z-10 h-full flex items-end p-14">
                    <div className="max-w-md">
                        <h2 className="text-5xl font-black text-white leading-tight mb-4">{hl}</h2>
                        <p className="text-white/70 text-lg leading-relaxed">{sub}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;