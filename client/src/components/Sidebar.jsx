// src/components/Sidebar.jsx — UPDATED
// Added: Community nav link (MessageSquare icon, /worker/community)
// All original nav links, styling, and logic preserved exactly

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, 
    Briefcase, 
    Trophy, 
    ShieldAlert, 
    History, 
    Cog,
    ChevronRight,
    Star,
    Calendar,
    UserCheck,
    Award,
    X,
    Users, 
    Layers,
    MessageSquare
} from 'lucide-react';

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const location = useLocation();
    
    const navLinks = [
        { 
            to: '/worker/dashboard', 
            icon: <LayoutDashboard size={20}/>, 
            text: 'Dashboard',
            description: 'Overview & analytics'
        },
        { 
            to: '/worker/job-requests', 
            icon: <Briefcase size={20}/>, 
            text: 'Job Requests',
            description: 'New opportunities',
        },
        { 
            to: '/worker/job-bookings', 
            icon: <Calendar size={20}/>, 
            text: 'My Bookings',
            description: 'Scheduled work',
        },
        {
            to: '/worker/community',
            icon: <MessageSquare size={20} />,
            text: 'Community',
            description: 'Connect with workers',
        },
        {
            to: '/worker/create-group',
            icon: <Users size={20} />,
            text: 'Create Group',
            description: 'Create a new worker group',
        },
        {
            to: '/worker/my-groups',
            icon: <Layers size={20} />,
            text: 'My Groups',
            description: 'View and manage your groups',
        },
        { 
            to: '/worker/leaderboard', 
            icon: <Trophy size={20}/>, 
            text: 'Leaderboard',
            description: 'Top performers',
        },
        { 
            to: '/worker/feedback', 
            icon: <Star size={20}/>, 
            text: 'Feedback & Ratings',
            description: 'Client reviews',
        },
        { 
            to: '/worker/complaints', 
            icon: <ShieldAlert size={20}/>, 
            text: 'Support',
            description: 'Help & complaints'
        },
        { 
            to: '/worker/history', 
            icon: <History size={20}/>, 
            text: 'Work History',
            description: 'Past projects'
        },
        { 
            to: '/worker/profile', 
            icon: <UserCheck size={20}/>, 
            text: 'My Profile',
            description: 'Personal details'
        },
        { 
            to: '/worker/settings', 
            icon: <Cog size={20}/>, 
            text: 'Settings',
            description: 'Account preferences'
        },
    ];

    const isActiveLink = (to) => location.pathname === to;

    const handleNavClick = () => {
        if (isSidebarOpen) {
            setIsSidebarOpen(false);
        }
    };

    return (
        <aside 
            className={`
                w-80 bg-gradient-to-b from-white to-orange-50 border-r border-orange-200 
                flex-shrink-0 overflow-y-auto flex flex-col
                fixed inset-y-0 left-0 z-50 
                transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:sticky lg:translate-x-0 lg:z-auto
            `}
        >
            <div className="p-6 border-b border-orange-200 bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Award size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg">Worker Portal</h2>
                        <p className="text-orange-100 text-sm">Manage your work & growth</p>
                    </div>
                </div>

                <button 
                    onClick={() => setIsSidebarOpen(false)} 
                    className="lg:hidden p-1 text-orange-100 hover:text-white"
                >
                    <X size={20} />
                </button>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navLinks.map((link) => {
                    const isActive = isActiveLink(link.to);
                    return (
                        <NavLink 
                            key={link.to} 
                            to={link.to}
                            onClick={handleNavClick}
                            className={`
                                relative flex items-center justify-between p-4 rounded-2xl transition-all duration-200 group
                                ${isActive 
                                    ? 'bg-white shadow-lg border border-orange-200 transform scale-[1.02]' 
                                    : 'hover:bg-white/80 hover:shadow-md hover:border hover:border-orange-100'
                                }
                            `}
                        >
                            {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl opacity-60"></div>
                            )}
                            
                            <div className="relative z-10 flex items-center space-x-4 flex-1">
                                <div className={`
                                    w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
                                    ${isActive 
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' 
                                        : 'bg-orange-100 text-orange-600 group-hover:bg-orange-200 group-hover:text-orange-700'
                                    }
                                `}>
                                    {link.icon}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <span className={`font-semibold transition-colors ${isActive ? 'text-orange-700' : 'text-gray-800 group-hover:text-orange-700'}`}>
                                        {link.text}
                                    </span>
                                    <p className={`text-sm transition-colors mt-1 ${isActive ? 'text-orange-600' : 'text-gray-500 group-hover:text-orange-600'}`}>
                                        {link.description}
                                    </p>
                                </div>
                            </div>
                            
                            <ChevronRight size={16} className={`transition-transform duration-200 ${isActive ? 'text-orange-500 transform translate-x-1' : 'text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1'}`} />
                            
                            {isActive && (
                                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-12 bg-gradient-to-b from-orange-500 to-amber-500 rounded-r-full"></div>
                            )}
                        </NavLink>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;