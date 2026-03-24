// src/components/Sidebar.jsx
import React from 'react';
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
    Award,
    Users,
    Layers,
    MessageSquare,
    Store,
    ChevronRight
} from 'lucide-react';

const Sidebar = () => {
    const location = useLocation();
    const { t } = useTranslation();

    const navLinks = [
        { to: '/worker/dashboard', icon: <LayoutDashboard size={22} />, text: t('worker_sidebar.dashboard') },
        { to: '/worker/job-requests', icon: <Briefcase size={22} />, text: t('worker_sidebar.job_requests') },
        { to: '/worker/job-bookings', icon: <Calendar size={22} />, text: t('worker_sidebar.my_bookings') },
        { to: '/worker/shops', icon: <Store size={22} />, text: t('worker_sidebar.shops', 'Shops'), isNew: true },
        { to: '/worker/community', icon: <MessageSquare size={22} />, text: t('worker_sidebar.community') },
        { to: '/worker/create-group', icon: <Users size={22} />, text: t('worker_sidebar.create_group') },
        { to: '/worker/my-groups', icon: <Layers size={22} />, text: t('worker_sidebar.my_groups') },
        { to: '/worker/leaderboard', icon: <Trophy size={22} />, text: t('worker_sidebar.leaderboard') },
        { to: '/worker/feedback', icon: <Star size={22} />, text: t('worker_sidebar.feedback') },
        { to: '/worker/history', icon: <History size={22} />, text: t('worker_sidebar.work_history') },
        { to: '/worker/profile', icon: <UserCheck size={22} />, text: t('worker_sidebar.my_profile') },
        { to: '/worker/complaints', icon: <ShieldAlert size={22} />, text: t('worker_sidebar.support') },
        { to: '/worker/settings', icon: <Cog size={22} />, text: t('worker_sidebar.settings') },
    ];

    const isActiveLink = (to) => location.pathname === to;

    return (
        <>
            {/* ── DESKTOP SIDEBAR (Vertical Scrollable) ── */}
            <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 border-r border-orange-200 bg-white">
                {/* Fixed Header */}
                <div className="p-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg"><Award size={24} /></div>
                        <h2 className="font-bold text-lg leading-tight">{t('worker_sidebar.worker_portal')}</h2>
                    </div>
                </div>

                {/* Scrollable Nav Area */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                    {navLinks.map((link) => {
                        const isActive = isActiveLink(link.to);
                        return (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={`flex items-center justify-between p-3 rounded-xl transition-all group ${
                                    isActive ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={isActive ? 'text-white' : 'text-orange-500'}>{link.icon}</span>
                                    <span className="font-semibold text-sm">{link.text}</span>
                                </div>
                                {link.isNew && !isActive && <span className="w-2 h-2 bg-orange-500 rounded-full" />}
                                <ChevronRight size={14} className={isActive ? 'text-white' : 'text-gray-300'} />
                            </NavLink>
                        );
                    })}
                </nav>
            </aside>

            {/* ── MOBILE BOTTOM NAVIGATION (Horizontal Scrollable) ── */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-orange-200 shadow-[0_-5px_20px_rgba(0,0,0,0.08)] pb-safe">
                <div className="flex items-center overflow-x-auto no-scrollbar h-16 px-2">
                    <div className="flex flex-nowrap gap-1">
                        {navLinks.map((link) => {
                            const isActive = isActiveLink(link.to);
                            return (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    className="flex-shrink-0 flex flex-col items-center justify-center min-w-[70px] h-full relative"
                                >
                                    {isActive && <div className="absolute top-0 w-8 h-1 bg-orange-500 rounded-b-full" />}
                                    <div className={`transition-colors duration-200 ${isActive ? 'text-orange-600' : 'text-gray-400'}`}>
                                        {link.icon}
                                    </div>
                                    <span className={`text-[10px] mt-1 font-bold whitespace-nowrap ${isActive ? 'text-orange-600' : 'text-gray-500'}`}>
                                        {link.text}
                                    </span>
                                </NavLink>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {/* ── SHARED CSS ── */}
            <style dangerouslySetInnerHTML={{ __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />

            {/* Mobile Spacer */}
            <div className="lg:hidden h-20" />
        </>
    );
};

export default Sidebar;