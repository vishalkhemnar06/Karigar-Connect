// src/components/Sidebar.jsx
// PREMIUM VERSION - Modern sidebar with gradients, animations, and enhanced UX

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Briefcase,
    Trophy,
    ShieldAlert,
    History,
    Cog,
    Star,
    Calendar,
    UserCheck,
    Users,
    Layers,
    MessageSquare,
    Store,
    Sparkles,
    ChevronRight,
    Menu,
    X,
    Home,
    Award,
    UserPlus,
    BookOpen,
    Heart,
    Bell,
    Settings,
    LogOut,
    HelpCircle,
    Sun,
    Moon
} from 'lucide-react';

const Sidebar = () => {
    const location = useLocation();
    const { t } = useTranslation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [hoveredItem, setHoveredItem] = useState(null);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const navLinks = [
        { to: '/worker/dashboard', icon: <LayoutDashboard size={20} />, text: t('worker_sidebar.dashboard', 'Dashboard'), gradient: 'from-orange-500 to-amber-500' },
        { to: '/worker/job-requests', icon: <Briefcase size={20} />, text: t('worker_sidebar.job_requests', 'Job Requests'), gradient: 'from-blue-500 to-cyan-500' },
        { to: '/worker/job-bookings', icon: <Calendar size={20} />, text: t('worker_sidebar.my_bookings', 'My Bookings'), gradient: 'from-emerald-500 to-teal-500' },
        { to: '/worker/direct-invites', icon: <Sparkles size={20} />, text: 'Direct Invites', gradient: 'from-purple-500 to-pink-500', isNew: true },
        { to: '/worker/shops', icon: <Store size={20} />, text: t('worker_sidebar.shops', 'Shops'), gradient: 'from-indigo-500 to-purple-500' },
        { to: '/worker/community', icon: <MessageSquare size={20} />, text: t('worker_sidebar.community', 'Community'), gradient: 'from-green-500 to-emerald-500' },
        { to: '/worker/create-group', icon: <Users size={20} />, text: t('worker_sidebar.create_group', 'Create Group'), gradient: 'from-amber-500 to-orange-500' },
        { to: '/worker/my-groups', icon: <Layers size={20} />, text: t('worker_sidebar.my_groups', 'My Groups'), gradient: 'from-blue-500 to-indigo-500' },
        { to: '/worker/leaderboard', icon: <Trophy size={20} />, text: t('worker_sidebar.leaderboard', 'Leaderboard'), gradient: 'from-yellow-500 to-amber-500' },
        { to: '/worker/feedback', icon: <Star size={20} />, text: t('worker_sidebar.feedback', 'Feedback'), gradient: 'from-pink-500 to-rose-500' },
        { to: '/worker/history', icon: <History size={20} />, text: t('worker_sidebar.work_history', 'Work History'), gradient: 'from-slate-500 to-gray-500' },
        { to: '/worker/profile', icon: <UserCheck size={20} />, text: t('worker_sidebar.my_profile', 'My Profile'), gradient: 'from-orange-500 to-amber-500' },
        { to: '/worker/complaints', icon: <ShieldAlert size={20} />, text: t('worker_sidebar.support', 'Support'), gradient: 'from-red-500 to-rose-500' },
        { to: '/worker/settings', icon: <Cog size={20} />, text: t('worker_sidebar.settings', 'Settings'), gradient: 'from-gray-600 to-gray-800' },
    ];

    const guideIdByRoute = {
        '/worker/dashboard': 'worker-nav-dashboard',
        '/worker/job-requests': 'worker-nav-job-requests',
        '/worker/job-bookings': 'worker-nav-job-bookings',
        '/worker/direct-invites': 'worker-nav-direct-invites',
        '/worker/shops': 'worker-nav-shops',
        '/worker/community': 'worker-nav-community',
        '/worker/create-group': 'worker-nav-create-group',
        '/worker/my-groups': 'worker-nav-my-groups',
        '/worker/leaderboard': 'worker-nav-leaderboard',
        '/worker/feedback': 'worker-nav-feedback',
        '/worker/history': 'worker-nav-history',
        '/worker/profile': 'worker-nav-profile',
        '/worker/complaints': 'worker-nav-complaints',
        '/worker/settings': 'worker-nav-settings',
    };

    const isActiveLink = (to) => location.pathname === to;

    const getActiveGradient = (gradient) => `bg-gradient-to-r ${gradient}`;

    return (
        <>
            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="lg:hidden fixed inset-x-0 top-16 sm:top-20 bottom-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Mobile Sidebar Drawer */}
            <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: mobileMenuOpen ? 0 : '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="lg:hidden fixed top-16 sm:top-20 bottom-0 left-0 z-50 w-80 bg-gradient-to-b from-orange-50 via-white to-white shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-orange-100 bg-gradient-to-r from-orange-500 to-amber-500">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <Home size="16" className="text-white" />
                            </div>
                            <span className="text-white font-bold text-sm">Menu</span>
                        </div>
                        <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                        >
                            <X size="16" className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                    {navLinks.map((link) => {
                        const isActive = isActiveLink(link.to);
                        const isHovered = hoveredItem === link.to;
                        const guideId = guideIdByRoute[link.to];
                        
                        return (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                onClick={() => setMobileMenuOpen(false)}
                                data-guide-id={guideId}
                                onMouseEnter={() => setHoveredItem(link.to)}
                                onMouseLeave={() => setHoveredItem(null)}
                                className={`flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 group ${
                                    isActive 
                                        ? `${getActiveGradient(link.gradient)} text-white shadow-md` 
                                        : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-orange-600'}>
                                        {link.icon}
                                    </span>
                                    <span className="font-semibold text-sm">{link.text}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {link.isNew && !isActive && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-bold rounded-full shadow-sm"
                                        >
                                            NEW
                                        </motion.span>
                                    )}
                                    {isActive && <ChevronRight size="14" className="text-white" />}
                                    {!isActive && isHovered && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-1.5 h-1.5 rounded-full bg-orange-500"
                                        />
                                    )}
                                </div>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-orange-100 bg-white">
                    <div className="text-center text-[10px] text-gray-400">
                        <p>© {new Date().getFullYear()} KarigarConnect™</p>
                        <p className="mt-0.5">Version 2.0</p>
                    </div>
                </div>
            </motion.div>

            {/* DESKTOP SIDEBAR */}
            <aside className="hidden lg:flex flex-col w-72 h-[calc(100vh-5rem)] sticky top-20 border-r border-orange-100 bg-gradient-to-b from-orange-50 via-white to-white shadow-lg overflow-hidden">
                {/* Header */}
            

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1 custom-scrollbar">
                    {navLinks.map((link) => {
                        const isActive = isActiveLink(link.to);
                        const isHovered = hoveredItem === link.to;
                        const guideId = guideIdByRoute[link.to];
                        
                        return (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                data-guide-id={guideId}
                                onMouseEnter={() => setHoveredItem(link.to)}
                                onMouseLeave={() => setHoveredItem(null)}
                                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                                    isActive 
                                        ? `${getActiveGradient(link.gradient)} text-white shadow-md shadow-orange-200` 
                                        : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-orange-600'}>
                                        {link.icon}
                                    </span>
                                    <span className="font-semibold text-sm">{link.text}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {link.isNew && !isActive && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-bold rounded-full shadow-sm"
                                        >
                                            NEW
                                        </motion.span>
                                    )}
                                    <ChevronRight 
                                        size="14" 
                                        className={`transition-all duration-200 ${
                                            isActive 
                                                ? 'text-white translate-x-0.5' 
                                                : isHovered 
                                                    ? 'text-orange-500 translate-x-0.5' 
                                                    : 'text-gray-300'
                                        }`} 
                                    />
                                </div>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-orange-100 bg-white">
                    <div className="text-center text-[10px] text-gray-400">
                        <p>© {new Date().getFullYear()} KarigarConnect™</p>
                        <p className="mt-0.5">Version 2.0</p>
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            {!mobileMenuOpen && (
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-orange-100 shadow-lg pb-safe">
                    <div className="flex items-center justify-around overflow-x-auto no-scrollbar h-16 px-2">
                        {navLinks.slice(0, 5).map((link) => {
                            const isActive = isActiveLink(link.to);
                            return (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    className="flex-shrink-0 flex flex-col items-center justify-center min-w-[70px] h-full relative group"
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute top-0 w-8 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                                        />
                                    )}
                                    <div className={`transition-all duration-200 ${
                                        isActive 
                                            ? 'text-orange-600 scale-110' 
                                            : 'text-gray-400 group-hover:text-orange-500'
                                    }`}>
                                        {link.icon}
                                    </div>
                                    <span className={`text-[10px] mt-1 font-semibold transition-colors whitespace-nowrap ${
                                        isActive ? 'text-orange-600' : 'text-gray-500'
                                    }`}>
                                        {link.text.length > 12 ? link.text.substring(0, 10) + '...' : link.text}
                                    </span>
                                    {link.isNew && !isActive && (
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                            className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                                        />
                                    )}
                                </NavLink>
                            );
                        })}
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="flex-shrink-0 flex flex-col items-center justify-center min-w-[70px] h-full text-gray-400 hover:text-orange-500 transition-colors group"
                        >
                            <Menu size="18" className="group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] mt-1 font-semibold">More</span>
                        </button>
                    </div>
                </nav>
            )}

            {/* Mobile Spacer */}
            {!mobileMenuOpen && <div className="lg:hidden h-16" />}

            {/* Custom Scrollbar Styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #fef3c7;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #f97316;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #ea580c;
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                @media (max-width: 1024px) {
                    .pb-safe {
                        padding-bottom: env(safe-area-inset-bottom);
                    }
                }
                
                .sidebar-transition {
                    transition: transform 0.3s ease-in-out;
                }
            `}</style>
        </>
    );
};

export default Sidebar;