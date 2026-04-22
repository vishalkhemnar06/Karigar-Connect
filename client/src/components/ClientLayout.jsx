// src/components/ClientLayout.jsx
// MOBILE-FRIENDLY VERSION - Fixed Overlap Issues

import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, PlusSquare, Briefcase, Bot,
    User, LogOut, X, Menu, ChevronRight, Sparkles,
    AlertTriangle, Users, History, Heart
} from 'lucide-react';
import WorkerProfilePreviewModal from './WorkerProfilePreviewModal';
import { WORKER_PROFILE_PREVIEW_EVENT } from '../utils/workerProfilePreview';
import { ClientOnboardingProvider } from '../context/ClientOnboardingContext';
import ClientOnboardingModal from './ClientOnboardingModal';

const navItems = [

    { to: '/client/dashboard',  label: 'Dashboard',   icon: LayoutDashboard, desc: 'Overview & stats' },
        { to: '/client/ai-assist',  label: 'AI Tool',     icon: Bot,             desc: 'Smart project planner' },
    { to: '/client/job-post',   label: 'Post Job',    icon: PlusSquare,      desc: 'Create new listing' },
    { to: '/client/job-manage', label: 'Manage Jobs', icon: Briefcase,       desc: 'Track all postings' },
    { to: '/client/history',    label: 'History',     icon: History,         desc: 'Past job records' },
    { to: '/client/favorites',  label: 'Favorites',   icon: Heart,           desc: 'Starred workers' },
    { to: '/client/hired-workers', label: 'Hired Workers', icon: Briefcase, desc: 'Direct hire jobs' },
    { to: '/client/groups',     label: 'Groups',      icon: Users,           desc: 'Find worker teams' },
    // { to: '/client/worker-face-verify', label: 'Face Verify', icon: Camera,  desc: 'Verify worker identity' },
    { to: '/client/complaints', label: 'Complaints',  icon: AlertTriangle,   desc: 'Report issues' },
    { to: '/client/profile',    label: 'Profile',     icon: User,            desc: 'Account settings' },
];

export default function ClientLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [showScrollHint, setShowScrollHint] = useState(true);
    const [previewWorkerId, setPreviewWorkerId] = useState('');
    const bottomNavRef = useRef(null);

    // Check if bottom nav is scrollable
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
            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map(({ to, label, icon: Icon, desc }) => (
                    <NavLink
                        key={to}
                        to={to}
                        onClick={onNavClick}
                        className={({ isActive }) =>
                            `group flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium transition-all duration-200 relative
                            ${isActive
                                ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md shadow-orange-200'
                                : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className={`p-1.5 rounded-lg flex-shrink-0 transition-all ${isActive ? 'bg-white/20' : 'bg-orange-100 group-hover:bg-orange-200'}`}>
                                    <Icon size={20} className={isActive ? 'text-white' : 'text-orange-600'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-base leading-tight">{label}</p>
                                    <p className={`text-sm leading-tight mt-0.5 ${isActive ? 'text-orange-100' : 'text-gray-500'}`}>{desc}</p>
                                </div>
                                <ChevronRight size={16} className={`flex-shrink-0 transition-transform ${isActive ? 'text-white/80 translate-x-0.5' : 'text-gray-300 group-hover:text-orange-400 group-hover:translate-x-0.5'}`} />
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div className="px-3 pb-4 pt-2 border-t border-orange-100">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium text-red-500 hover:bg-red-50 transition-all duration-200 group"
                >
                    <div className="p-1.5 bg-red-100 rounded-lg group-hover:bg-red-200 transition-all">
                        <LogOut size={20} className="text-red-500" />
                    </div>
                    <span className="font-bold text-base">Logout</span>
                </button>
            </div>
        </div>
    );

    return (
        <ClientOnboardingProvider>
        <div className="flex min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-72 bg-gradient-to-b from-orange-50 via-white to-white border-r border-orange-100 shadow-sm fixed top-20 left-0 h-[calc(100vh-5rem)] z-30">
                <SidebarContent onNavClick={undefined} />
            </aside>

            {/* Mobile Overlay */}
            {menuOpen && (
                <div className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setMenuOpen(false)} />
            )}

            {/* Mobile Drawer */}
            <aside className={`md:hidden fixed top-16 bottom-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={() => setMenuOpen(false)} className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-all">
                        <X size={18} />
                    </button>
                </div>
                <SidebarContent onNavClick={() => setMenuOpen(false)} />
            </aside>

            {/* Page Content with Proper Spacing for Mobile */}
            <main className="flex-1 md:ml-72 min-h-screen">
                {/* Mobile Top Bar Spacer - Prevents content from hiding behind fixed header */}
                <div className="md:hidden h-14" />
                
                {/* Main Content */}
                <div className="pb-20 md:pb-0">
                    <Outlet />
                </div>

                {previewWorkerId && (
                    <WorkerProfilePreviewModal
                        workerId={previewWorkerId}
                        onClose={closeWorkerProfilePreview}
                    />
                )}
                
                {/* Mobile Bottom Navigation Spacer - Prevents content from hiding behind bottom nav */}
                <div className="md:hidden h-16" />
            </main>

            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-orange-100 px-4 py-3 flex items-center justify-between shadow-sm">
                <button 
                    onClick={() => setMenuOpen(true)} 
                    className="p-2 rounded-xl text-gray-600 hover:bg-orange-50 transition-all active:bg-orange-100"
                >
                    <Menu size={22} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <span className="font-black text-orange-600 tracking-tighter text-sm">KARIGAR CONNECT</span>
                </div>
                <div className="w-9" />
            </div>

            {/* Mobile Bottom Navigation - Scrollable */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-orange-100 shadow-lg">
                {/* Scroll Hint */}
                {showScrollHint && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded-full opacity-70 whitespace-nowrap animate-pulse">
                        ← Scroll for more →
                    </div>
                )}
                
                {/* Scrollable Navigation */}
                <div 
                    ref={bottomNavRef}
                    className="overflow-x-auto overflow-y-hidden scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <div className="flex px-2 py-2 min-w-max">
                        {navItems.map(({ to, label, icon: Icon }) => {
                            const isActive = location.pathname === to;
                            return (
                                <NavLink
                                    key={to}
                                    to={to}
                                    className={({ isActive }) =>
                                        `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[64px] ${
                                            isActive 
                                                ? 'text-orange-600 bg-orange-50' 
                                                : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50/50'
                                        }`
                                    }
                                >
                                    <Icon size={22} className={isActive ? 'text-orange-500' : ''} />
                                    <span className={`text-xs font-semibold whitespace-nowrap ${isActive ? 'text-orange-600' : 'text-gray-500'}`}>
                                        {label}
                                    </span>
                                    {isActive && (
                                        <div className="w-1 h-1 bg-orange-500 rounded-full mt-0.5" />
                                    )}
                                </NavLink>
                            );
                        })}
                    </div>
                </div>
            </div>

            <ClientOnboardingModal />

            {/* Hide scrollbar styles */}
            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
        </ClientOnboardingProvider>
    );
}

