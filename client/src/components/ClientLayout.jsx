// src/components/ClientLayout.jsx — UPDATED
// Added: 'Browse Groups' nav item pointing to /client/groups
// All original code preserved exactly

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getImageUrl } from '../constants/config';
import * as api from '../api';
import {
    LayoutDashboard, PlusSquare, Briefcase, Bot,
    User, LogOut, X, Menu, ChevronRight, Sparkles,
    AlertTriangle, Users, Camera
} from 'lucide-react';

const navItems = [
    { to: '/client/dashboard',  label: 'Dashboard',       icon: LayoutDashboard, desc: 'Overview & stats' },
    { to: '/client/job-post',   label: 'Post a Job',      icon: PlusSquare,      desc: 'Create new listing' },
    { to: '/client/job-manage', label: 'Manage Jobs',     icon: Briefcase,       desc: 'Track all postings' },
    { to: '/client/ai-assist',  label: 'AI Scope Tool',   icon: Bot,             desc: 'Smart project planner' },
    { to: '/client/groups',     label: 'Browse Groups',   icon: Users,           desc: 'Find worker teams' },   // NEW
    { to: '/client/worker-face-verify', label: 'Verify Worker Face', icon: Camera, desc: 'Confirm assigned worker' },
    { to: '/client/complaints', label: 'Complaints',      icon: AlertTriangle,   desc: 'Report worker issues' },
    { to: '/client/profile',    label: 'My Profile',      icon: User,            desc: 'Account settings' },
];

export default function ClientLayout() {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [profile, setProfile]   = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data } = await api.getClientProfile();
                setProfile(data);
            } catch {
                try {
                    const stored = JSON.parse(localStorage.getItem('user') || '{}');
                    setProfile(stored);
                } catch { /* ignore */ }
            }
        };
        fetchProfile();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        navigate('/login');
    };

    const SidebarContent = ({ onNavClick }) => (
        <div className="flex flex-col h-full">
            {/* Profile Header */}
            <div className="p-5 bg-gradient-to-br from-orange-500 to-orange-600 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
                </div>
                <div className="relative flex items-center gap-3">
                    <div className="relative">
                        <img
                            src={getImageUrl(profile?.photo, `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'Client')}&background=ff7e33&color=fff`)}
                            alt={profile?.name || 'Client'}
                            className="w-12 h-12 rounded-2xl object-cover border-2 border-white/50 shadow-lg"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-white text-sm truncate">{profile?.name || 'Client'}</p>
                        <p className="text-orange-100 text-xs truncate">{profile?.email || profile?.mobile || 'Employer'}</p>
                    </div>
                </div>
                <div className="relative mt-4 flex items-center gap-2">
                    <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold rounded-lg flex items-center gap-1">
                        <Sparkles size={10} /> Employer Account
                    </span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map(({ to, label, icon: Icon, desc }) => (
                    <NavLink
                        key={to}
                        to={to}
                        onClick={onNavClick}
                        className={({ isActive }) =>
                            `group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative
                            ${isActive
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                                : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className={`p-1.5 rounded-lg flex-shrink-0 transition-all ${isActive ? 'bg-white/20' : 'bg-orange-100 group-hover:bg-orange-200'}`}>
                                    <Icon size={16} className={isActive ? 'text-white' : 'text-orange-600'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm leading-tight">{label}</p>
                                    <p className={`text-xs leading-tight mt-0.5 ${isActive ? 'text-orange-100' : 'text-gray-400'}`}>{desc}</p>
                                </div>
                                <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${isActive ? 'text-white/80 translate-x-0.5' : 'text-gray-300 group-hover:text-orange-400 group-hover:translate-x-0.5'}`} />
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div className="px-3 pb-4 pt-2 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all duration-200 group"
                >
                    <div className="p-1.5 bg-red-100 rounded-lg group-hover:bg-red-200 transition-all">
                        <LogOut size={16} className="text-red-500" />
                    </div>
                    <span className="font-bold">Logout</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-orange-100 shadow-sm fixed top-0 left-0 h-full z-20">
                <SidebarContent onNavClick={undefined} />
            </aside>

            {/* Mobile Overlay */}
            {menuOpen && (
                <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setMenuOpen(false)} />
            )}

            {/* Mobile Drawer */}
            <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={() => setMenuOpen(false)} className="p-2 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-all">
                        <X size={18} />
                    </button>
                </div>
                <SidebarContent onNavClick={() => setMenuOpen(false)} />
            </aside>

            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-orange-100 px-4 py-3 flex items-center justify-between shadow-sm">
                <button onClick={() => setMenuOpen(true)} className="p-2 rounded-xl text-gray-600 hover:bg-orange-50 transition-all">
                    <Menu size={22} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <span className="font-black text-orange-600 tracking-tighter">KARIGAR CONNECT</span>
                </div>
                <div className="w-9" />
            </div>

            {/* Page Content */}
            <main className="flex-1 md:ml-64 min-h-screen pt-14 md:pt-0">
                <Outlet />
            </main>
        </div>
    );
}