// src/components/admin/AdminSidebar.jsx
// Separate sidebar component for Admin Dashboard
// Desktop: fixed left sidebar, scrollable
// Mobile: hidden sidebar + bottom navigation bar

import React from 'react';
import { useLocation } from 'react-router-dom';
import {
    Users, UserCheck, UserX, Clock, ShieldX,
    AlertTriangle, MessageSquare, Store, X as CloseIcon,
    ShieldAlert, BarChart3
} from 'lucide-react';

const NAV_SECTIONS = [
    {
        label: 'Overview',
        items: [
            { path: '/admin/dashboard', label: 'Dashboard', icon: BarChart3, isFilter: false, isSection: true },
        ]
    },
    {
        label: 'Workers',
        items: [
            { filter: 'pending',  label: 'Pending Review', icon: Clock,     isFilter: true },
            { filter: 'approved', label: 'Approved',       icon: UserCheck, isFilter: true },
            { filter: 'rejected', label: 'Rejected',       icon: UserX,     isFilter: true },
            { filter: 'blocked',  label: 'Blocked',        icon: ShieldX,   isFilter: true },
        ]
    },
    {
        label: 'Clients',
        items: [
            { filter: 'clients', label: 'All Clients', icon: Users, isFilter: true },
        ]
    },
    {
        label: 'Monitoring',
        items: [
            { path: '/admin/fraud', label: 'Fraud Monitor', icon: ShieldAlert, isFilter: false },
        ]
    },
    {
        label: 'Complaints',
        items: [
            { path: '/admin/complaints',        label: 'Client Complaints', icon: AlertTriangle, isFilter: false },
            { path: '/admin/worker-complaints', label: 'Worker Complaints', icon: MessageSquare, isFilter: false },
        ]
    },
    {
        label: 'Community',
        items: [
            { path: '/admin/community', label: 'Manage Posts', icon: MessageSquare, isFilter: false },
        ]
    },
    {
        label: 'Shop Management',
        items: [
            { path: '/admin/shops', label: 'Shops & Coupons', icon: Store, isFilter: false },
        ]
    },
];

// Bottom nav — 5 slots covering all page-level routes + most critical filter
const BOTTOM_NAV_ITEMS = [
    { filter: 'pending',             label: 'Pending',    icon: Clock,        isFilter: true  },
    { path: '/admin/fraud',          label: 'Fraud',      icon: ShieldAlert,  isFilter: false },
    { path: '/admin/complaints',     label: 'Client Complaints', icon: AlertTriangle,isFilter: false },
    { path: '/admin/worker-complaints',     label: 'Worker Complaints', icon: AlertTriangle,isFilter: false },
    { path: '/admin/community',      label: 'Community',  icon: MessageSquare,isFilter: false },
    { path: '/admin/shops',          label: 'Shops',      icon: Store,        isFilter: false },
];

const AdminSidebar = ({
    isOpen,
    onClose,
    activeFilter,
    onFilterChange,
    currentSection,
    onSectionChange,
    stats = {},
    dashboardStats = {},
    onViewModeChange = () => {},
}) => {
    useLocation();

    const handleNav = (item) => {
        if (item.isFilter) {
            onFilterChange(item.filter);
            // Avoid triggering duplicate route transitions when already on dashboard.
            if (currentSection !== 'dashboard') {
                onSectionChange('dashboard');
            }
            onViewModeChange('records');
        } else if (item.isSection) {
            onSectionChange('dashboard');
            onViewModeChange('stats');
        } else {
            const sectionMap = {
                '/admin/fraud': 'fraud',
                '/admin/complaints': 'complaints',
                '/admin/worker-complaints': 'worker-complaints',
                '/admin/community': 'community',
                '/admin/shops': 'shops',
            };
            onSectionChange(sectionMap[item.path] || 'dashboard');
            onViewModeChange('stats');
        }
        onClose();
    };

    const isActive = (item) => {
        if (item.isFilter) return activeFilter === item.filter;
        if (item.isSection) return currentSection === 'dashboard';
        const sectionMap = {
            '/admin/fraud': 'fraud',
            '/admin/complaints': 'complaints',
            '/admin/worker-complaints': 'worker-complaints',
            '/admin/community': 'community',
            '/admin/shops': 'shops',
        };
        return currentSection === (sectionMap[item.path] || 'dashboard');
    };

    const getCount = (filter) => {
        const map = {
            pending:  stats.pending,
            approved: stats.approved,
            rejected: stats.rejected,
            blocked:  stats.blocked,
            clients:  stats.totalClients,
        };
        return map[filter];
    };

    return (
        <>
            {/* Mobile Menu Overlay */}
            {isOpen && (
                <div className="lg:hidden fixed inset-x-0 top-16 bottom-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 opacity-100 pointer-events-auto" onClick={onClose} />
            )}

            {/* Mobile Sidebar Drawer */}
            <aside className={`lg:hidden fixed top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-gradient-to-b from-orange-50 via-white to-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Removed logo section */}
                <div className="px-3 py-3 border-b border-orange-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200 transition-colors"
                        aria-label="Close menu"
                    >
                        <CloseIcon size={16} />
                    </button>
                </div>
                {/* Scrollable nav */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 pb-24">
                    {NAV_SECTIONS.map((section) => (
                        <div key={section.label}>
                            <p className="px-3 mb-1.5 text-[10px] font-black text-orange-400 uppercase tracking-widest">
                                {section.label}
                            </p>
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const Icon   = item.icon;
                                    const active = isActive(item);
                                    const count  = item.isFilter ? getCount(item.filter) : undefined;
                                    return (
                                        <button
                                            key={item.filter || item.path}
                                            onClick={() => handleNav(item)}
                                            className={`flex items-center w-full px-3 py-3 rounded-xl text-base font-medium tracking-wide transition-all duration-150 group ${active ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md shadow-orange-200' : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'}`}
                                            style={{ transition: 'all 0.18s cubic-bezier(.4,0,.2,1)' }}
                                        >
                                            <Icon size={16} className={`mr-3 shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-orange-500'}`} />
                                            <span className="flex-1 text-left font-semibold text-base">{item.label}</span>
                                            {count !== undefined && (
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center ${active ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-600'}`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* DESKTOP SIDEBAR */}
            <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-gradient-to-b from-orange-50 via-white to-white border-r border-orange-100 h-[calc(100vh-64px)] sticky top-16 shadow-sm">
                {/* Removed logo section */}
                {/* Scrollable nav */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
                    {NAV_SECTIONS.map((section) => (
                        <div key={section.label}>
                            <p className="px-3 mb-1.5 text-[10px] font-black text-orange-400 uppercase tracking-widest">
                                {section.label}
                            </p>
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const Icon   = item.icon;
                                    const active = isActive(item);
                                    const count  = item.isFilter ? getCount(item.filter) : undefined;
                                    return (
                                        <button
                                            key={item.filter || item.path}
                                            onClick={() => handleNav(item)}
                                            className={`flex items-center w-full px-4 py-3 rounded-xl text-base font-semibold tracking-wide transition-all duration-150 group ${active ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md shadow-orange-200' : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'}`}
                                            style={{ transition: 'all 0.18s cubic-bezier(.4,0,.2,1)' }}
                                        >
                                            <Icon size={18} className={`mr-3 shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-orange-500'}`} />
                                            <span className="flex-1 text-left font-semibold text-base">{item.label}</span>
                                            {count !== undefined && (
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center ${active ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-600'}`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
                {/* Footer */}
                <div className="px-4 py-3 border-t border-orange-50">
                    <p className="text-[10px] text-gray-400 text-center">KarigarConnect Admin v2.0</p>
                </div>
            </aside>

            {/* ── Mobile Bottom Navigation Bar ───────────────────────── */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-orange-100 shadow-[0_-4px_20px_rgba(234,88,12,0.08)]">
                <div className="flex items-center justify-around px-1 py-1 safe-area-inset-bottom">
                    {BOTTOM_NAV_ITEMS.map((item) => {
                        const Icon   = item.icon;
                        const active = isActive(item);
                        const count  = item.isFilter ? getCount(item.filter) : undefined;
                        return (
                            <button
                                key={item.filter || item.path}
                                onClick={() => {
                                    if (item.isFilter) {
                                        onFilterChange(item.filter);
                                        if (currentSection !== 'dashboard') {
                                            onSectionChange('dashboard');
                                        }
                                        onViewModeChange('records');
                                    } else {
                                        handleNav(item);
                                    }
                                }}
                                className={`flex flex-col items-center justify-center px-2 py-2 rounded-xl flex-1 relative transition-all duration-200
                                    ${active ? 'text-orange-600' : 'text-gray-400'}`}
                            >
                                {/* Active pill */}
                                {active && (
                                    <span className="absolute inset-0 bg-orange-50 rounded-xl" />
                                )}

                                {/* Badge */}
                                {count !== undefined && count > 0 && (
                                    <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center z-10">
                                        {count > 99 ? '99+' : count}
                                    </span>
                                )}

                                <Icon size={20} className={`relative z-10 transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                                <span className={`relative z-10 text-[10px] mt-0.5 font-semibold leading-none ${active ? 'text-orange-600' : 'text-gray-400'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};

export default AdminSidebar;