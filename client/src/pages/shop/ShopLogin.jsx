// client/src/pages/shop/ShopLogin.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Store, Phone, Lock, LogIn } from 'lucide-react';

const ShopLogin = () => {
    const navigate = useNavigate();
    const [mobile, setMobile]   = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading]   = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.shopLogin({ mobile, password });
            localStorage.setItem('shopToken', data.token);
            localStorage.setItem('shopRole', 'shop');
            localStorage.setItem('shop', JSON.stringify(data.shop));
            toast.success('Login successful!');
            navigate('/shop/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed.');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-orange-100 px-4 py-2 rounded-full mb-3">
                        <Store size={20} className="text-orange-600" />
                        <span className="font-bold text-orange-700">Shop Portal</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Shop Owner Login</h1>
                    <p className="text-gray-500 text-sm">Login to manage your shop on KarigarConnect</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                                <input
                                    type="tel" placeholder="Registered mobile" maxLength={10} required
                                    value={mobile} onChange={e => setMobile(e.target.value)}
                                    className="w-full border border-orange-100 rounded-lg py-3 pl-9 pr-3 bg-orange-50 focus:ring-2 focus:ring-orange-400 outline-none text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                                <input
                                    type="password" placeholder="Your password" required
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    className="w-full border border-orange-100 rounded-lg py-3 pl-9 pr-3 bg-orange-50 focus:ring-2 focus:ring-orange-400 outline-none text-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <LogIn size={18} />
                            {loading ? 'Logging in...' : 'Login to Dashboard'}
                        </button>
                    </form>
                    <p className="text-center text-sm text-gray-500 mt-4">
                        New shop?{' '}
                        <Link to="/shop/register" className="text-orange-600 font-bold hover:underline">Register here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShopLogin;