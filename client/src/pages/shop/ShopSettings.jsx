// client/src/pages/shop/ShopSettings.jsx
// PREMIUM VERSION - Modern settings page with enhanced UI and animations

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertTriangle, LogOut, BookOpen, Shield, Key, 
    Phone, Mail, MapPin, Store, Tag, Calendar, 
    CheckCircle, XCircle, Clock, Globe, Lock,
    Smartphone, User, Building2, CreditCard,
    Settings, Bell, Heart, ThumbsUp, Star, Award,
    Crown, Diamond, Sparkles, Zap, Gift, ShieldCheck,
    Fingerprint, Eye, EyeOff, Loader2, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../../api';
import { useShopOnboarding } from '../../context/ShopOnboardingContext';

const ShopSettings = () => {
    const navigate = useNavigate();
    const { restartGuideFromSettings } = useShopOnboarding();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalTransactions: 0,
        totalRevenue: 0,
        totalCouponsUsed: 0
    });

    useEffect(() => {
        const loadShopData = async () => {
            try {
                const shopData = JSON.parse(localStorage.getItem('shop') || '{}');
                setShop(shopData);
                
                // Fetch shop stats
                const [productsRes, transactionsRes, analyticsRes] = await Promise.all([
                    api.getShopProducts(),
                    api.getShopTransactions(),
                    api.getShopAnalytics()
                ]);
                
                setStats({
                    totalProducts: productsRes.data?.length || 0,
                    totalTransactions: transactionsRes.data?.length || 0,
                    totalRevenue: analyticsRes.data?.totalSales || 0,
                    totalCouponsUsed: analyticsRes.data?.totalCouponsUsed || 0
                });
            } catch (error) {
                console.error('Error loading shop data:', error);
            } finally {
                setLoading(false);
            }
        };
        
        loadShopData();
    }, []);

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') {
            toast.error('Please type DELETE to confirm account deletion');
            return;
        }

        setIsDeleting(true);
        try {
            await api.deleteShopAccount();
            
            localStorage.removeItem('shopToken');
            localStorage.removeItem('shopRole');
            localStorage.removeItem('shop');
            
            toast.success('Account deleted successfully', {
                icon: '👋',
                style: { background: '#fef3c7', color: '#9a3412' }
            });

            setTimeout(() => navigate('/login'), 1500);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete account');
            setIsDeleting(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size="40" className="animate-spin text-orange-500 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Settings size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black" data-guide-id="shop-sidebar-settings">
                                        Account Settings
                                    </h1>
                                    <p className="text-white/90 text-sm mt-0.5">Manage your shop account and preferences</p>
                                </div>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={restartGuideFromSettings}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                            >
                                <BookOpen size="14" /> User Guide
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard 
                        title="Products" 
                        value={stats.totalProducts} 
                        icon={Store} 
                        gradient="from-orange-500 to-amber-500" 
                        delay={0.05}
                    />
                    <StatCard 
                        title="Transactions" 
                        value={stats.totalTransactions} 
                        icon={ShoppingBag} 
                        gradient="from-blue-500 to-cyan-500" 
                        delay={0.1}
                    />
                    <StatCard 
                        title="Revenue" 
                        value={`₹${stats.totalRevenue.toLocaleString()}`} 
                        icon={TrendingUp} 
                        gradient="from-emerald-500 to-teal-500" 
                        delay={0.15}
                    />
                    <StatCard 
                        title="Coupons Used" 
                        value={stats.totalCouponsUsed} 
                        icon={Tag} 
                        gradient="from-purple-500 to-pink-500" 
                        delay={0.2}
                    />
                </div>

                {/* Shop Information Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mb-6"
                >
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-100">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                                <Store size="14" className="text-white" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">Shop Information</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InfoItem label="Shop Name" value={shop.shopName || 'Not set'} icon={Store} color="orange" />
                            <InfoItem label="Category" value={shop.category || 'Not set'} icon={Tag} color="blue" />
                            <InfoItem label="Owner Name" value={shop.ownerName || 'Not set'} icon={User} color="purple" />
                            <InfoItem label="Mobile" value={shop.mobile || 'Not set'} icon={Phone} color="green" />
                            <InfoItem label="Email" value={shop.email || 'Not set'} icon={Mail} color="red" />
                            <InfoItem label="City" value={shop.city || 'Not set'} icon={MapPin} color="indigo" />
                            <InfoItem label="Account Status" value="Active" icon={CheckCircle} color="emerald" />
                            <InfoItem label="Member Since" value={formatDate(shop.createdAt)} icon={Calendar} color="gray" />
                        </div>
                    </div>
                </motion.div>

                {/* Security Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mb-6"
                >
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                                <Shield size="14" className="text-white" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">Security & Privacy</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InfoItem label="Account ID" value={shop._id || 'N/A'} icon={Fingerprint} color="blue" monospace />
                            <InfoItem label="Verification Status" value={shop.verificationStatus || 'Pending'} icon={ShieldCheck} color="amber" />
                            <InfoItem label="Two-Factor Auth" value="Not Enabled" icon={Lock} color="gray" />
                            <InfoItem label="Last Login" value={new Date().toLocaleDateString()} icon={Clock} color="gray" />
                        </div>
                    </div>
                </motion.div>

                {/* Danger Zone Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl shadow-md border border-red-200 overflow-hidden"
                >
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 px-6 py-4 border-b border-red-200">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 flex items-center justify-center">
                                <AlertTriangle size="14" className="text-white" />
                            </div>
                            <h2 className="text-lg font-bold text-red-800">Danger Zone</h2>
                        </div>
                        <p className="text-sm text-red-700 mt-1 ml-10">Irreversible actions - proceed with caution</p>
                    </div>

                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-800">Delete Account Permanently</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Once deleted, your shop account and all associated data cannot be recovered.
                                </p>
                                <ul className="text-xs text-gray-400 mt-2 space-y-1">
                                    <li>• All shop data will be permanently deleted</li>
                                    <li>• Shop profile will no longer be visible</li>
                                    <li>• Active transactions can't be recovered</li>
                                    <li>• This action cannot be undone</li>
                                </ul>
                            </div>
                            {!showDeleteConfirm && (
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold rounded-xl text-sm hover:shadow-md transition-all"
                                >
                                    Delete Account
                                </motion.button>
                            )}
                        </div>

                        <AnimatePresence>
                            {showDeleteConfirm && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-5 pt-5 border-t border-red-100"
                                >
                                    <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-xl p-5 border border-red-200">
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className="p-2 bg-red-100 rounded-lg">
                                                <AlertTriangle size="18" className="text-red-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-red-800 text-sm mb-1">Are you absolutely sure?</h4>
                                                <p className="text-xs text-red-700">
                                                    This action will permanently delete your shop account and all associated data.
                                                </p>
                                            </div>
                                        </div>

                                        <p className="text-sm font-semibold text-red-800 mb-3">
                                            Type <span className="font-mono font-bold bg-red-200 px-1.5 py-0.5 rounded">DELETE</span> to confirm:
                                        </p>

                                        <input
                                            type="text"
                                            value={deleteConfirmText}
                                            onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                                            placeholder="Type DELETE to confirm"
                                            className="w-full px-4 py-3 border-2 border-red-300 rounded-xl font-mono font-semibold text-center text-red-800 placeholder-red-300 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 mb-4 bg-white"
                                        />

                                        <div className="flex gap-3">
                                            <motion.button
                                                whileTap={{ scale: 0.95 }}
                                                onClick={handleDeleteAccount}
                                                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                                                className={`flex-1 py-3 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 ${
                                                    deleteConfirmText === 'DELETE' && !isDeleting
                                                        ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md hover:shadow-lg'
                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                }`}
                                            >
                                                {isDeleting ? (
                                                    <>
                                                        <Loader2 size="14" className="animate-spin" />
                                                        Deleting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Trash2 size="14" />
                                                        Delete Account Permanently
                                                    </>
                                                )}
                                            </motion.button>
                                            <button
                                                onClick={() => {
                                                    setShowDeleteConfirm(false);
                                                    setDeleteConfirmText('');
                                                }}
                                                disabled={isDeleting}
                                                className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Help Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mt-6 text-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100">
                        <HelpCircle size="12" className="text-orange-500" />
                        <span className="text-[10px] text-gray-500">Need help? Contact support at <a href="mailto:support@karigarconnect.com" className="text-orange-600 font-semibold">support@karigarconnect.com</a></span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

// Helper Components
const StatCard = ({ title, value, icon: Icon, gradient, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        whileHover={{ y: -2 }}
        className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all"
    >
        <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{title}</p>
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center shadow-sm`}>
                <Icon size="14" className="text-white" />
            </div>
        </div>
        <p className="text-xl font-bold text-gray-800">{value}</p>
    </motion.div>
);

const InfoItem = ({ label, value, icon: Icon, color, monospace = false }) => {
    const colorClasses = {
        orange: 'bg-orange-50 border-orange-100 text-orange-700',
        blue: 'bg-blue-50 border-blue-100 text-blue-700',
        purple: 'bg-purple-50 border-purple-100 text-purple-700',
        green: 'bg-green-50 border-green-100 text-green-700',
        red: 'bg-red-50 border-red-100 text-red-700',
        indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
        emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
        amber: 'bg-amber-50 border-amber-100 text-amber-700',
        gray: 'bg-gray-50 border-gray-100 text-gray-700',
    };

    return (
        <div className={`rounded-xl p-3 border ${colorClasses[color] || colorClasses.gray}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <Icon size="12" className="opacity-70" />
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            </div>
            <p className={`text-sm font-semibold break-words ${monospace ? 'font-mono' : ''}`}>{value}</p>
        </div>
    );
};

// Additional Icons needed
const ShoppingBag = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
);

const TrendingUp = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 6l-9.5 9.5-5-5L1 18" />
        <path d="M17 6h6v6" />
    </svg>
);

const Trash2 = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const HelpCircle = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

export default ShopSettings;