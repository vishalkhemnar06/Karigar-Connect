// src/components/ClientLayout.jsx
// PREMIUM VERSION - Modern layout with gradients, animations, and enhanced UX

import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, PlusSquare, Briefcase, Bot,
    User, LogOut, X, Menu, ChevronRight, Sparkles,
    AlertTriangle, Users, History, Heart, Home,
    Settings, Bell, HelpCircle, Star, Award,
    Crown, Diamond, Zap, Gift, Calendar, Clock,
    TrendingUp, Activity, BarChart3, PieChart, Store
} from 'lucide-react';
import WorkerProfilePreviewModal from './WorkerProfilePreviewModal';
import { WORKER_PROFILE_PREVIEW_EVENT } from '../utils/workerProfilePreview';
import { ClientOnboardingProvider } from '../context/ClientOnboardingContext';
import ClientOnboardingModal from './ClientOnboardingModal';
import ClientChatbotWidget from './ClientChatbotWidget';

const navItems = [
    
    { to: '/client/dashboard',  label: 'Dashboard',   icon: LayoutDashboard, desc: 'Overview & stats', gradient: 'from-orange-500 to-amber-500', color: 'orange' },
        { to: '/client/profile',    label: 'Profile',     icon: User,            desc: 'Account settings', gradient: 'from-gray-600 to-gray-800', color: 'gray' },
    { to: '/client/ai-assist',  label: 'AI Tool',     icon: Bot,             desc: 'Smart project planner', gradient: 'from-purple-500 to-pink-500', color: 'purple' },
    { to: '/client/job-post',   label: 'Post Job',    icon: PlusSquare,      desc: 'Create new listing', gradient: 'from-emerald-500 to-teal-500', color: 'emerald' },
    { to: '/client/job-manage', label: 'Manage Jobs', icon: Briefcase,       desc: 'Track all postings', gradient: 'from-blue-500 to-cyan-500', color: 'blue' },
    { to: '/client/favorites',  label: 'Favorites',   icon: Heart,           desc: 'Starred workers', gradient: 'from-rose-500 to-pink-500', color: 'rose' },
        { to: '/client/nearby-shops', label: 'Nearby Shops', icon: Store, desc: 'Buy materials locally', gradient: 'from-emerald-500 to-teal-500', color: 'emerald' },
    { to: '/client/hired-workers', label: 'Hired Workers', icon: Briefcase, desc: 'Direct hire jobs', gradient: 'from-indigo-500 to-purple-500', color: 'indigo' },
    { to: '/client/groups',     label: 'Groups',      icon: Users,           desc: 'Find worker teams', gradient: 'from-amber-500 to-orange-500', color: 'amber' },
    { to: '/client/complaints', label: 'Complaints',  icon: AlertTriangle,   desc: 'Report issues', gradient: 'from-red-500 to-rose-500', color: 'red' },
    { to: '/client/history',    label: 'History',     icon: History,         desc: 'Past job records', gradient: 'from-slate-500 to-gray-500', color: 'slate' },

];

const CHATBOT_HIDDEN_ROUTE_PATTERNS = [
    /^\/client\/settings(?:\/|$)/i,
    /^\/client\/hired-workers(?:\/|$)/i,
    /^\/client\/worker-face-verify(?:\/|$)/i,
    /payment/i,
    /password/i,
    /otp/i,
    /security/i,
    /secure/i,
];

const shouldHideChatbotOnRoute = (pathname = '') => {
    const path = String(pathname || '').toLowerCase();
    return CHATBOT_HIDDEN_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
};

export default function ClientLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [showScrollHint, setShowScrollHint] = useState(true);
    const [previewWorkerId, setPreviewWorkerId] = useState('');
    const [scrolled, setScrolled] = useState(false);
    const bottomNavRef = useRef(null);
    const hideChatbot = shouldHideChatbotOnRoute(location.pathname);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const checkScrollable = () => {
            if (bottomNavRef.current) {
                const isScrollable = bottomNavRef.current.scrollWidth > bottomNavRef.current.clientWidth;
                setShowScrollHint(isScrollable);
            }
        };
        checkScrollable();
        window.addEventListener('resize', checkScrollable);
        return () => window.removeEventListener('resize', checkScrollable);
    }, []);

    useEffect(() => {
        const handleOpenPreview = (event) => {
            const workerId = String(event?.detail?.workerId || '').trim();
            if (workerId) {
                setPreviewWorkerId(workerId);
            }
        };
        window.addEventListener(WORKER_PROFILE_PREVIEW_EVENT, handleOpenPreview);
        return () => window.removeEventListener(WORKER_PROFILE_PREVIEW_EVENT, handleOpenPreview);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        navigate('/login');
    };

    const closeWorkerProfilePreview = () => {
        setPreviewWorkerId('');
    };

    const SidebarContent = ({ onNavClick }) => (
        <div className="flex flex-col h-full">
            {/* User Profile Section */}
            <div className="px-4 py-5 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                        <User size="18" className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm truncate">Client Portal</p>
                        <p className="text-[10px] text-gray-500">Manage your projects</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                {navItems.map(({ to, label, icon: Icon, desc, gradient, color }) => {
                    const isActive = location.pathname === to;
                    const activeGradient = `bg-gradient-to-r ${gradient}`;
                    
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={onNavClick}
                            className={({ isActive }) =>
                                `group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative
                                ${isActive
                                    ? `${activeGradient} text-white shadow-md shadow-orange-200`
                                    : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <div className={`p-1.5 rounded-lg flex-shrink-0 transition-all ${isActive ? 'bg-white/20' : 'bg-orange-100 group-hover:bg-orange-200'}`}>
                                        <Icon size="18" className={isActive ? 'text-white' : `text-${color}-500`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm leading-tight">{label}</p>
                                        <p className={`text-[11px] leading-tight mt-0.5 ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{desc}</p>
                                    </div>
                                    {isActive && <ChevronRight size="14" className="flex-shrink-0 text-white/80" />}
                                    {!isActive && (
                                        <ChevronRight size="14" className="flex-shrink-0 text-gray-300 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Logout Button */}
            <div className="px-3 pb-4 pt-2 border-t border-orange-100">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200 group"
                >
                    <div className="p-1.5 bg-red-100 rounded-lg group-hover:bg-red-200 transition-all">
                        <LogOut size="18" className="text-red-500" />
                    </div>
                    <span className="font-semibold text-sm">Logout</span>
                </motion.button>
            </div>
        </div>
    );

    return (
        <ClientOnboardingProvider>
            <div className="flex min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10">
                
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex flex-col w-72 bg-gradient-to-b from-orange-50 via-white to-orange-50 border-r border-orange-100 shadow-lg fixed top-0 left-0 h-screen z-30">
                    <SidebarContent onNavClick={undefined} />
                </aside>

                {/* Mobile Overlay */}
                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            onClick={() => setMenuOpen(false)}
                        />
                    )}
                </AnimatePresence>

                {/* Mobile Drawer */}
                <motion.aside
                    initial={{ x: '-100%' }}
                    animate={{ x: menuOpen ? 0 : '-100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="md:hidden fixed top-0 bottom-0 left-0 z-50 w-80 bg-gradient-to-b from-orange-50 via-white to-orange-50 shadow-2xl flex flex-col"
                >
                    <div className="absolute top-4 right-4 z-10">
                        <button
                            onClick={() => setMenuOpen(false)}
                            className="p-2 bg-white rounded-lg shadow-md text-gray-600 hover:bg-gray-50 transition-all"
                        >
                            <X size="18" />
                        </button>
                    </div>
                    <SidebarContent onNavClick={() => setMenuOpen(false)} />
                </motion.aside>

                {/* Page Content */}
                <main className="flex-1 md:ml-72 min-h-screen">
                    {/* Mobile Top Bar */}
                    <div className={`md:hidden fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-orange-100 px-4 py-3 flex items-center justify-between transition-all duration-300 ${
                        scrolled ? 'shadow-md' : ''
                    }`}>
                        <button 
                            onClick={() => setMenuOpen(true)} 
                            className="p-2 rounded-xl text-gray-600 hover:bg-orange-50 transition-all active:scale-95"
                        >
                            <Menu size="22" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                                <Sparkles size="14" className="text-white" />
                            </div>
                            <span className="font-black text-orange-600 tracking-tight text-sm">KARIGAR CONNECT</span>
                        </div>
                        <div className="w-9" />
                    </div>

                    {/* Mobile Top Bar Spacer */}
                    <div className="md:hidden h-14" />
                    
                    {/* Main Content */}
                    <div className="pb-20 md:pb-0">
                        <Outlet />
                    </div>

                    {/* Worker Profile Preview Modal */}
                    {previewWorkerId && (
                        <WorkerProfilePreviewModal
                            workerId={previewWorkerId}
                            onClose={closeWorkerProfilePreview}
                        />
                    )}
                    
                    {/* Mobile Bottom Navigation Spacer */}
                    <div className="md:hidden h-16" />
                </main>

                {/* Mobile Bottom Navigation */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-orange-100 shadow-lg pb-safe">
                    {/* Scroll Hint */}
                    <AnimatePresence>
                        {showScrollHint && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap"
                            >
                                ← Scroll for more →
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    {/* Scrollable Navigation */}
                    <div 
                        ref={bottomNavRef}
                        className="overflow-x-auto overflow-y-hidden scrollbar-hide"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <div className="flex px-2 py-2 min-w-max gap-1">
                            {navItems.map(({ to, label, icon: Icon }) => {
                                const isActive = location.pathname === to;
                                return (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        className={({ isActive }) =>
                                            `flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[65px] group ${
                                                isActive 
                                                    ? 'text-orange-600 bg-gradient-to-r from-orange-50 to-amber-50' 
                                                    : 'text-gray-500 hover:text-orange-500 hover:bg-orange-50/50'
                                            }`
                                        }
                                    >
                                        <div className={`transition-all duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                                            <Icon size="20" className={isActive ? 'text-orange-500' : ''} />
                                        </div>
                                        <span className={`text-[10px] font-semibold whitespace-nowrap ${isActive ? 'text-orange-600' : 'text-gray-500'}`}>
                                            {label}
                                        </span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeDot"
                                                className="w-1.5 h-1.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full mt-0.5"
                                            />
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                </nav>

                {/* Onboarding Modal */}
                <ClientOnboardingModal />

                {/* Global Client Chatbot */}
                {!hideChatbot && <ClientChatbotWidget />}

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
                    .scrollbar-hide::-webkit-scrollbar {
                        display: none;
                    }
                    .scrollbar-hide {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                    .pb-safe {
                        padding-bottom: env(safe-area-inset-bottom);
                    }
                `}</style>
            </div>
        </ClientOnboardingProvider>
    );
}