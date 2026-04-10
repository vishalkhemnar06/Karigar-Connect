import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, Menu, X, Home, LayoutDashboard, LogOut, User,
    Settings, Bell, Store, Globe, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getImageUrl } from '../utils/imageUrl';
import logo from '../assets/logo.jpg';
import NotificationBell from '../components/NotificationBell';

const LANGUAGES = [
    { code: 'en', label: 'English', native: 'English', flag: '🇬🇧', icon: '🌎' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', icon: '🇮🇳' },
    { code: 'mr', label: 'Marathi', native: 'मराठी', flag: '🇮🇳', icon: '🇮🇳' },
];

const LanguageSwitcher = () => {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(LANGUAGES[0]);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const changeLanguage = (lang) => {
        setSelected(lang);
        setOpen(false);
        if (lang.code === 'en') {
            document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.reload();
            return;
        }
        const cookieValue = `/en/${lang.code}`;
        document.cookie = `googtrans=${cookieValue}; path=/`;
        window.location.reload();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-gray-50 to-white border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all duration-300"
            >
                <Globe size={14} className="text-orange-500" />
                <span className="text-xs font-semibold text-gray-700 hidden sm:inline">{selected.native}</span>
                <ChevronDown size={12} className="text-gray-400" />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 overflow-hidden"
                    >
                        <div className="px-4 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                            <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Select Language</p>
                        </div>
                        {LANGUAGES.map((lang, idx) => (
                            <motion.button
                                key={lang.code}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => changeLanguage(lang)}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-200"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{lang.flag}</span>
                                    <div className="text-left">
                                        <p className="font-semibold text-gray-800 text-sm">{lang.native}</p>
                                        <p className="text-xs text-gray-400">{lang.label}</p>
                                    </div>
                                </div>
                                {selected.code === lang.code && (
                                    <Check size={12} className="text-orange-500" />
                                )}
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ShopHeader = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const shopToken = localStorage.getItem('shopToken');
    const shop = JSON.parse(localStorage.getItem('shop') || '{}');

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Handle navigation to settings page in dashboard
    const navigateToSettings = () => {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
        navigate('/shop/dashboard', { state: { openSettings: true } });
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownOpen && !event.target.closest('.profile-menu')) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const isActive = (path) => location.pathname === path;

    const navLinkClass = (path) => `
        relative px-3 lg:px-4 py-2 text-sm font-semibold transition-all duration-300 
        ${isActive(path) 
            ? 'text-orange-600' 
            : 'text-gray-700 hover:text-orange-600'
        } group whitespace-nowrap
    `;

    const handleLogout = () => {
        localStorage.removeItem('shopToken');
        localStorage.removeItem('shopRole');
        localStorage.removeItem('shop');
        navigate('/login');
        toast.success('Logged out successfully!', {
            icon: '👋',
            style: { background: '#ffedd5', color: '#9a3412' }
        });
    };

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`sticky top-0 z-50 transition-all duration-500 ${
                scrolled
                    ? 'bg-white/95 backdrop-blur-xl shadow-2xl border-b border-orange-100/50'
                    : 'bg-white shadow-lg'
            }`}
            style={{ fontFamily: 'Inter, sans-serif' }}
        >
            {/* Gradient Bar */}
            <motion.div 
                className="h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-red-500 opacity-90"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
            />

            <div className="w-full px-5">
                <div className="flex items-center justify-between h-20 gap-2">
                    {/* Logo & Brand */}
                    <Link to="/" className="flex items-center gap-3 group flex-shrink-0" aria-label="Home">
                        <motion.div whileHover={{ scale: 1.08, rotate: 2 }} className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full blur-md opacity-40 group-hover:opacity-80 transition-opacity" />
                            <img
                                src={logo}
                                alt="KarigarConnect Logo"
                                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-orange-300 shadow-xl"
                                style={{ background: '#fff' }}
                            />
                        </motion.div>
                        <div className="flex flex-col justify-center">
                            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 bg-clip-text text-transparent tracking-tight">
                                KarigarConnect
                            </span>
                            <span className="hidden sm:block text-xs font-medium text-gray-400 tracking-wide mt-0.5">
                                Shop Portal
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-1 lg:gap-2 xl:gap-3 flex-wrap">
                        <Link to="/" className={navLinkClass('/')}>
                            <div className="flex items-center gap-1">
                                <Home size={16} className={isActive('/') ? 'text-orange-500' : ''} />
                                <span>Home</span>
                            </div>
                        </Link>

                        {shopToken && (
                            <>
                                <Link to="/shop/dashboard" className={navLinkClass('/shop/dashboard')}>
                                    <div className="flex items-center gap-1">
                                        <LayoutDashboard size={16} className={isActive('/shop/dashboard') ? 'text-orange-500' : ''} />
                                        <span>Dashboard</span>
                                    </div>
                                </Link>

                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Bell className="w-5 h-5 text-gray-600 hover:text-orange-500 cursor-pointer" />
                                </motion.div>

                                <LanguageSwitcher />

                                {/* Profile Dropdown */}
                                <div className="relative profile-menu">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-2.5 py-1.5 rounded-full bg-gradient-to-r from-gray-50 to-white border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all duration-300"
                                    >
                                        <div className="relative">
                                            <img
                                                src={getImageUrl(shop?.shopLogo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop?.shopName || 'S')}&background=f97316&color=fff&bold=true&size=32`}
                                                alt="Shop"
                                                className="w-7 h-7 lg:w-8 lg:h-8 rounded-full object-cover border-2 border-orange-300 shadow-sm"
                                            />
                                        </div>
                                        <span className="text-xs lg:text-sm font-bold text-gray-700 hidden lg:block truncate">
                                            {shop?.shopName?.split(' ')[0] || 'Shop'}
                                        </span>
                                        <motion.div animate={{ rotate: dropdownOpen ? 180 : 0 }}>
                                            <ChevronDown size={12} className="text-gray-500" />
                                        </motion.div>
                                    </motion.button>

                                    <AnimatePresence>
                                        {dropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                transition={{ duration: 0.2 }}
                                                className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                                            >
                                                {/* Profile Header */}
                                                <div className="relative px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                        src={getImageUrl(shop?.shopLogo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop?.shopName || 'S')}&background=f97316&color=fff&bold=true&size=48`}
                                                            alt="Shop"
                                                            className="w-12 h-12 rounded-full object-cover border-3 border-orange-300 shadow-md"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="text-base font-bold text-gray-900">{shop?.shopName}</p>
                                                            <p className="text-xs text-orange-600 font-medium mt-0.5">
                                                                Owner: {shop?.ownerName}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Menu Items */}
                                                <button type="button" onClick={navigateToSettings} className="w-full text-left">
                                                    <div className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-200 group cursor-pointer">
                                                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <Settings size={16} className="text-purple-500" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-medium text-gray-700">Settings</p>
                                                            <p className="text-xs text-gray-400">Account preferences</p>
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* Logout Button */}
                                                <div className="border-t border-gray-100 mt-2 pt-2">
                                                    <button type="button" onClick={handleLogout} className="w-full text-left">
                                                        <div className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 transition-all duration-200 group cursor-pointer">
                                                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                <LogOut size={16} className="text-red-500" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-medium text-red-600">Logout</p>
                                                                <p className="text-xs text-gray-400">Sign out of account</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-300"
                        >
                            {mobileMenuOpen ? <X size={20} className="text-orange-500" /> : <Menu size={20} />}
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && shopToken && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="md:hidden bg-white border-t border-gray-100 shadow-xl"
                    >
                        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
                            <Link
                                to="/shop/dashboard"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 rounded-xl transition-all"
                            >
                                <LayoutDashboard size={18} className="text-orange-500" />
                                <span className="font-medium">Dashboard</span>
                            </Link>

                            <button
                                type="button"
                                onClick={navigateToSettings}
                                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 rounded-xl transition-all"
                            >
                                <Settings size={18} className="text-orange-500" />
                                <span className="font-medium">Settings</span>
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <LogOut size={18} className="text-red-500" />
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
};

export default ShopHeader;
