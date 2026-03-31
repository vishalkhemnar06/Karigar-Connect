// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    X
} from 'lucide-react';

const Sidebar = () => {
    const location = useLocation();
    const { t } = useTranslation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu when route changes
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const navLinks = [
        { to: '/worker/dashboard', icon: <LayoutDashboard size={20} />, text: t('worker_sidebar.dashboard', 'Dashboard') },
        { to: '/worker/job-requests', icon: <Briefcase size={20} />, text: t('worker_sidebar.job_requests', 'Job Requests') },
        { to: '/worker/job-bookings', icon: <Calendar size={20} />, text: t('worker_sidebar.my_bookings', 'My Bookings') },
        { to: '/worker/direct-invites', icon: <Sparkles size={20} />, text: 'Direct Invites', isNew: false },
        { to: '/worker/shops', icon: <Store size={20} />, text: t('worker_sidebar.shops', 'Shops'), isNew: false },
        { to: '/worker/community', icon: <MessageSquare size={20} />, text: t('worker_sidebar.community', 'Community') },
        { to: '/worker/create-group', icon: <Users size={20} />, text: t('worker_sidebar.create_group', 'Create Group') },
        { to: '/worker/my-groups', icon: <Layers size={20} />, text: t('worker_sidebar.my_groups', 'My Groups') },
        { to: '/worker/leaderboard', icon: <Trophy size={20} />, text: t('worker_sidebar.leaderboard', 'Leaderboard') },
        { to: '/worker/feedback', icon: <Star size={20} />, text: t('worker_sidebar.feedback', 'Feedback') },
        { to: '/worker/history', icon: <History size={20} />, text: t('worker_sidebar.work_history', 'Work History') },
        { to: '/worker/profile', icon: <UserCheck size={20} />, text: t('worker_sidebar.my_profile', 'My Profile') },
        { to: '/worker/complaints', icon: <ShieldAlert size={20} />, text: t('worker_sidebar.support', 'Support') },
        { to: '/worker/settings', icon: <Cog size={20} />, text: t('worker_sidebar.settings', 'Settings') },
    ];

    const isActiveLink = (to) => location.pathname === to;

    return (
        <>
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-x-0 top-16 sm:top-20 bottom-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            )}

            {/* Mobile Sidebar Drawer */}
            <div className={`
                lg:hidden fixed top-16 sm:top-20 bottom-0 left-0 z-50 w-72 bg-gradient-to-b from-orange-50 via-white to-white shadow-2xl transform transition-transform duration-300 ease-in-out
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex flex-col h-full">
                    <div className="p-3 flex justify-end border-b border-gray-100">
                        <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                            aria-label="Close menu"
                        >
                            <X size={18} className="text-gray-700" />
                        </button>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                        {navLinks.map((link) => {
                            const isActive = isActiveLink(link.to);
                            return (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center justify-between px-3 py-3 rounded-xl transition-all group text-base font-medium tracking-wide ${
                                        isActive 
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md' 
                                            : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                                    }`}
                                    style={{ transition: 'all 0.18s cubic-bezier(.4,0,.2,1)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={isActive ? 'text-white' : 'text-orange-500 group-hover:text-orange-600'}>
                                            {link.icon}
                                        </span>
                                        <span className="font-semibold text-base">{link.text}</span>
                                    </div>
                                    {link.isNew && !isActive && (
                                        <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-full">
                                            NEW
                                        </span>
                                    )}
                                    {isActive && <ChevronRight size={14} className="text-white" />}
                                </NavLink>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-orange-100">
                        <div className="text-center text-xs text-gray-400">
                              &copy; {new Date().getFullYear()} KarigarConnect™.
                        </div>
                    </div>
                </div>
            </div>

            {/* DESKTOP SIDEBAR */}
            <aside className="hidden lg:flex flex-col w-72 h-[calc(100vh-5rem)] sticky top-20 border-r border-orange-100 bg-gradient-to-b from-orange-50 via-white to-white shadow-sm">
                {/* Scrollable Nav Area */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                    {navLinks.map((link) => {
                        const isActive = isActiveLink(link.to);
                        return (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group text-base font-semibold tracking-wide ${
                                    isActive 
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md' 
                                        : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                                }`}
                                style={{ transition: 'all 0.18s cubic-bezier(.4,0,.2,1)' }}
                            >
                                <div className="flex items-center gap-4">
                                    <span className={isActive ? 'text-white' : 'text-orange-500 group-hover:text-orange-600'}>
                                        {link.icon}
                                    </span>
                                    <span className="font-semibold text-base">{link.text}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {link.isNew && !isActive && (
                                        <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                                            NEW
                                        </span>
                                    )}
                                    <ChevronRight 
                                        size={14} 
                                        className={`transition-transform group-hover:translate-x-0.5 ${
                                            isActive ? 'text-white' : 'text-gray-300'
                                        }`} 
                                    />
                                </div>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Desktop Footer */}
                <div className="p-4 border-t border-orange-100">
                    <div className="text-center text-xs text-gray-400">
                        <p>   &copy; {new Date().getFullYear()} KarigarConnect™.</p>
                        <p className="mt-1">Version 2.0</p>
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Navigation - Only show when menu is closed */}
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
                                        <div className="absolute top-0 w-8 h-0.5 bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" />
                                    )}
                                    <div className={`transition-all duration-200 ${isActive ? 'text-orange-600 scale-110' : 'text-gray-400 group-hover:text-orange-500'}`}>
                                        {link.icon}
                                    </div>
                                    <span className={`text-[11px] mt-1 font-semibold transition-colors whitespace-nowrap ${
                                        isActive ? 'text-orange-600' : 'text-gray-500'
                                    }`}>
                                        {link.text.length > 12 ? link.text.substring(0, 10) + '...' : link.text}
                                    </span>
                                    {link.isNew && !isActive && (
                                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                                    )}
                                </NavLink>
                            );
                        })}
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="flex-shrink-0 flex flex-col items-center justify-center min-w-[70px] h-full text-gray-400 hover:text-orange-500 transition-colors"
                        >
                            <Menu size={20} />
                            <span className="text-[11px] mt-1 font-semibold">More</span>
                        </button>
                    </div>
                </nav>
            )}

            {/* Mobile Spacer - Only show when bottom nav is visible */}
            {!mobileMenuOpen && <div className="lg:hidden h-16" />}

            {/* Shared CSS */}
            <style dangerouslySetInnerHTML={{ __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                @media (max-width: 1024px) {
                    .pb-safe {
                        padding-bottom: env(safe-area-inset-bottom);
                    }
                }
                
                /* Smooth transitions */
                .sidebar-transition {
                    transition: transform 0.3s ease-in-out;
                }
            `}} />
        </>
    );
};

export default Sidebar;