// src/components/Header.jsx
// UPDATED: Mobile optimized with consistent sizing + i18n translation support

import React, { useState, useEffect } from 'react';
import { getImageUrl } from '../constants/config';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X, Home, LayoutDashboard, User, LogOut, Settings, CreditCard, Bell, Zap, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import * as api from '../api';
import logo from '../assets/logo.jpg';
import NotificationBell from '../components/NotificationBell';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');
    const user  = JSON.parse(localStorage.getItem('user') || '{}');

    const toSafeText = (val, fallback = '') => {
        if (val === null || val === undefined) return fallback;
        if (typeof val === 'string' || typeof val === 'number') return String(val);
        if (typeof val === 'object') {
            if (typeof val.label === 'string') return val.label;
            if (typeof val.value === 'string' || typeof val.value === 'number') return String(val.value);
        }
        return fallback;
    };

    const userName = toSafeText(user?.name, 'User');
    const userKarigarId = toSafeText(user?.karigarId, '');

    const [isAvailable,    setIsAvailable]    = useState(true);
    const [dropdownOpen,   setDropdownOpen]   = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled,       setScrolled]       = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (role === 'worker') {
            const fetchProfile = async () => {
                try {
                    const { data } = await api.getWorkerProfile();
                    setIsAvailable(data.availability);
                } catch {
                    console.error('Could not fetch initial availability status.');
                }
            };
            fetchProfile();
        }
    }, [role]);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location]);

    let dashboardLink = '/';
    if (role === 'worker') dashboardLink = '/worker/dashboard';
    else if (role === 'client') dashboardLink = '/client/dashboard';

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
        toast.success(t('navbar.logout'));
        setMobileMenuOpen(false);
    };

    const toggleAvailability = async () => {
        const previousState = isAvailable;
        setIsAvailable(!previousState);
        try {
            const { data } = await api.toggleAvailability();
            setIsAvailable(data.availability);
            toast.success(`${t('navbar.availability')} ${data.availability ? t('common.on') : t('common.off')}`);
        } catch {
            setIsAvailable(previousState);
            toast.error('Failed to update availability. Please try again.');
        }
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

    // Close mobile menu when pressing escape
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [mobileMenuOpen]);

    const navLinkClass = 'relative font-bold text-gray-700 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-100 to-amber-50 border border-orange-200 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 hover:from-orange-200 hover:to-amber-100 group overflow-hidden';

    return (
        <>
            <motion.header
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    scrolled ? 'bg-white/98 backdrop-blur-md shadow-xl' : 'bg-white shadow-md'
                }`}
            >
                <nav className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex justify-between items-center">
                    {/* ── Logo (Mobile Optimized) ── */}
                    <Link to="/" className="flex items-center space-x-2 sm:space-x-3 group flex-shrink-0">
                        <motion.div whileTap={{ scale: 0.95 }} className="relative">
                            <img
                                src={logo}
                                alt="KarigarConnect Logo"
                                className="h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full border-2 border-orange-200 object-cover shadow-md"
                            />
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-red-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                        </motion.div>
                        <div className="hidden sm:block relative">
                            <span className="text-lg sm:text-xl md:text-2xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                                KarigarConnect
                            </span>
                            <motion.div
                                initial={{ scaleX: 0 }}
                                whileHover={{ scaleX: 1 }}
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-500 origin-left"
                            />
                        </div>
                    </Link>

                    {/* ── Mobile: Icons + Hamburger (Fixed Size) ── */}
                    <div className="flex items-center gap-1 sm:gap-2 md:hidden">
                        {/* Language Switcher - compact on mobile */}
                        <div className="transform scale-90 sm:scale-100">
                            <LanguageSwitcher compact />
                        </div>

                        {token && (role === 'worker' || role === 'client') && (
                            <div className="transform scale-90 sm:scale-100">
                                <NotificationBell role={role} />
                            </div>
                        )}
                        
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="p-1.5 sm:p-2 rounded-xl bg-orange-50 hover:bg-orange-100 transition-all touch-manipulation"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                        >
                            {mobileMenuOpen
                                ? <X size={20} className="sm:size-5 text-orange-500" />
                                : <Menu size={20} className="sm:size-5 text-orange-500" />
                            }
                        </motion.button>
                    </div>

                    {/* ── Desktop Navigation ── */}
                    <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
                        {/* Home Link */}
                        <Link to="/" className={navLinkClass}>
                            <span className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
                            <span className="relative flex items-center justify-center gap-2">
                                <Home size={16} className="text-orange-500" />
                                <span>{t('navbar.home')}</span>
                            </span>
                        </Link>

                        {token ? (
                            <>
                                {/* Dashboard */}
                                <Link to={dashboardLink} className={navLinkClass}>
                                    <span className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-orange-500/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
                                    <span className="relative flex items-center justify-center gap-2">
                                        <LayoutDashboard size={16} className="text-orange-500" />
                                        <span>{t('navbar.dashboard')}</span>
                                    </span>
                                </Link>

                                {/* Worker Availability Toggle */}
                                {role === 'worker' && (
                                    <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                                        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                                            <Zap size={12} className="text-orange-500" />
                                            {t('navbar.availability')}:
                                        </span>
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={toggleAvailability}
                                            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-all duration-300 focus:outline-none shadow-sm ${
                                                isAvailable
                                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                                    : 'bg-gradient-to-r from-gray-400 to-gray-500'
                                            }`}
                                        >
                                            <motion.span
                                                animate={{ x: isAvailable ? 18 : 2 }}
                                                className="inline-block h-4 w-4 transform rounded-full bg-white shadow-md"
                                            />
                                        </motion.button>
                                        <span className={`text-[10px] font-bold ${isAvailable ? 'text-green-600' : 'text-gray-500'}`}>
                                            {isAvailable ? t('common.on') : t('common.off')}
                                        </span>
                                    </div>
                                )}

                                {/* Notification Bell */}
                                {(role === 'worker' || role === 'client') && (
                                    <NotificationBell role={role} />
                                )}

                                {/* Language Switcher (Desktop) */}
                                <LanguageSwitcher />

                                {/* Profile Dropdown */}
                                {(role === 'worker' || role === 'client') && (
                                    <div className="relative profile-menu">
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setDropdownOpen(!dropdownOpen)}
                                            className="flex items-center space-x-2 group"
                                        >
                                            <div className="relative">
  <img
  src={getImageUrl(
    user?.photo,
        `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'U')}&background=fb923c&color=fff&bold=true`
  )}
  alt="Profile"
  className="h-10 w-10 rounded-full object-cover border-2 border-orange-200"
/>

  {role === 'worker' && isAvailable && (
    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
  )}
</div>
                                            <ChevronDown
                                                size={14}
                                                className={`text-gray-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                                            />
                                        </motion.button>

                                        <AnimatePresence>
                                            {dropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl py-2 z-50 ring-1 ring-black ring-opacity-5 border border-gray-100"
                                                >
                                                    <div className="px-4 py-3 border-b border-gray-100">
                                                        <p className="font-black text-gray-800 truncate text-sm">{userName}</p>
                                                        <p className="text-xs text-gray-500 font-mono mt-0.5">{userKarigarId}</p>
                                                        {role === 'worker' && (
                                                            <div className="flex items-center gap-1 mt-2">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {isAvailable ? `🟢 ${t('common.available')}` : `⚫ ${t('common.busy')}`}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {role === 'worker' && (
                                                        <>
                                                            <Link
                                                                to="/worker/profile"
                                                                onClick={() => setDropdownOpen(false)}
                                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 transition-all"
                                                            >
                                                                <User size={14} className="text-orange-500" />
                                                                {t('navbar.view_profile')}
                                                            </Link>
                                                            <Link
                                                                to="/worker/id-card"
                                                                onClick={() => setDropdownOpen(false)}
                                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 transition-all"
                                                            >
                                                                <CreditCard size={14} className="text-orange-500" />
                                                                {t('navbar.view_id_card')}
                                                            </Link>
                                                            <Link
                                                                to="/worker/settings"
                                                                onClick={() => setDropdownOpen(false)}
                                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 transition-all"
                                                            >
                                                                <Settings size={14} className="text-orange-500" />
                                                                {t('navbar.settings')}
                                                            </Link>
                                                        </>
                                                    )}

                                                    {role === 'client' && (
                                                        <Link
                                                            to="/client/settings"
                                                            onClick={() => setDropdownOpen(false)}
                                                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 transition-all"
                                                        >
                                                            <Settings size={14} className="text-orange-500" />
                                                            {t('navbar.settings')}
                                                        </Link>
                                                    )}

                                                    <div className="border-t border-gray-100 mt-1 pt-1">
                                                        <button
                                                            onClick={handleLogout}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all"
                                                        >
                                                            <LogOut size={14} />
                                                            {t('navbar.logout')}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <Link to="/login" className={navLinkClass}>
                                    <span className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-orange-500/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
                                    <span className="relative flex items-center justify-center gap-2">
                                        <span>{t('navbar.login')}</span>
                                    </span>
                                </Link>
                                <Link
                                    to="/register"
                                    className={`${navLinkClass} bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 border-none`}
                                >
                                    <span className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
                                    <span className="relative flex items-center justify-center gap-2">
                                        <Sparkles size={16} />
                                        {t('navbar.get_started')}
                                    </span>
                                </Link>

                                {/* Language Switcher for non-logged-in users */}
                                <LanguageSwitcher />
                            </>
                        )}
                    </div>
                </nav>
            </motion.header>

            {/* ── Mobile Menu Dropdown (Bottom Sheet Style) ── */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed top-[60px] left-0 right-0 bg-white shadow-2xl border-t border-gray-100 md:hidden z-40 max-h-[calc(100vh-60px)] overflow-y-auto"
                    >
                        <div className="container mx-auto px-4 py-4 space-y-2">
                            {/* Language Switcher in mobile menu */}
                            <div className="px-2 pb-3 border-b border-gray-100 mb-2">
                                <p className="text-[10px] text-gray-400 font-semibold mb-2 px-2">🌐 Language / भाषा</p>
                                <LanguageSwitcher fullWidth />
                            </div>

                            <Link
                                to="/"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-3 font-semibold text-gray-700 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 transition-all active:scale-98"
                            >
                                <Home size={18} className="text-orange-500" />
                                {t('navbar.home')}
                            </Link>

                            {token ? (
                                <>
                                    <Link
                                        to={dashboardLink}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3 font-medium text-gray-600 px-4 py-3 rounded-xl hover:bg-orange-50 active:bg-orange-100 transition-all"
                                    >
                                        <LayoutDashboard size={18} className="text-orange-500" />
                                        {t('navbar.dashboard')}
                                    </Link>

                                    {role === 'worker' && (
                                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl mx-2">
                                            <div className="flex items-center gap-2">
                                                <Zap size={16} className="text-orange-500" />
                                                <span className="text-sm font-semibold text-gray-700">{t('navbar.availability')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={toggleAvailability}
                                                    className={`relative inline-flex h-7 w-11 items-center rounded-full transition-all ${
                                                        isAvailable
                                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                                            : 'bg-gray-400'
                                                    }`}
                                                >
                                                    <motion.span
                                                        animate={{ x: isAvailable ? 20 : 2 }}
                                                        className="inline-block h-5 w-5 transform rounded-full bg-white shadow-md"
                                                    />
                                                </motion.button>
                                                <span className={`text-xs font-bold ${isAvailable ? 'text-green-600' : 'text-gray-500'}`}>
                                                    {isAvailable ? t('common.on') : t('common.off')}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t border-gray-100 pt-3 mt-2">
                                        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl mx-2 mb-2">
                                            <img
                                                src={
                                                    user?.photo
                                                        ? (user.photo.startsWith('http') ? user.photo : `http://localhost:5000/${user.photo}`)
                                                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'U')}&background=fb923c&color=fff&bold=true`
                                                }
                                                alt="Profile"
                                                className="h-10 w-10 rounded-full object-cover border-2 border-orange-200"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-800 text-sm truncate">{userName}</p>
                                                <p className="text-xs text-gray-500 font-mono truncate">{userKarigarId}</p>
                                            </div>
                                        </div>

                                        {role === 'worker' && (
                                            <>
                                                <Link
                                                    to="/worker/profile"
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 active:bg-orange-100 rounded-xl transition-all"
                                                >
                                                    <User size={16} className="text-orange-500" />
                                                    {t('navbar.view_profile')}
                                                </Link>
                                                <Link
                                                    to="/worker/id-card"
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 active:bg-orange-100 rounded-xl transition-all"
                                                >
                                                    <CreditCard size={16} className="text-orange-500" />
                                                    {t('navbar.view_id_card')}
                                                </Link>
                                                <Link
                                                    to="/worker/settings"
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 active:bg-orange-100 rounded-xl transition-all"
                                                >
                                                    <Settings size={16} className="text-orange-500" />
                                                    {t('navbar.settings')}
                                                </Link>
                                            </>
                                        )}

                                        {role === 'client' && (
                                            <Link
                                                to="/client/settings"
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-50 active:bg-orange-100 rounded-xl transition-all"
                                            >
                                                <Settings size={16} className="text-orange-500" />
                                                {t('navbar.settings')}
                                            </Link>
                                        )}

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 active:bg-red-100 rounded-xl transition-all mt-2"
                                        >
                                            <LogOut size={16} />
                                            {t('navbar.logout')}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block font-semibold text-center text-gray-700 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 active:scale-98 transition-all"
                                    >
                                        {t('navbar.login')}
                                    </Link>
                                    <Link
                                        to="/register"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block font-semibold text-center text-white px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:shadow-lg active:scale-98 transition-all"
                                    >
                                        {t('navbar.get_started')}
                                    </Link>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Spacer to prevent content from hiding under fixed header */}
            <div className="h-[60px] md:h-[70px]" />

            <style>{`
                @media (max-width: 768px) {
                    .active\\:scale-98:active {
                        transform: scale(0.98);
                    }
                }
            `}</style>
        </>
    );
};

export default Header;