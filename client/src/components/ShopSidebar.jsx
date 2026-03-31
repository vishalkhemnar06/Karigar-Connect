import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Package,
    TrendingUp,
    Settings,
    UserCheck,
    Menu,
    X,
    QrCode,
    History,
    BarChart3,
    LogOut,
    ChevronRight
} from 'lucide-react';

const ShopSidebar = ({ page = 'analytics', onPageChange = () => {}, onLogout = () => {} }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [page]);

    const navLinks = [
        { key: 'analytics', icon: <BarChart3 size={20} />, text: 'Analytics' },
        { key: 'coupon', icon: <QrCode size={20} />, text: 'Coupon' },
        { key: 'products', icon: <Package size={20} />, text: 'Products' },
        { key: 'history', icon: <History size={20} />, text: 'History' },
        { key: 'profile', icon: <UserCheck size={20} />, text: 'Profile' },
        { key: 'settings', icon: <Settings size={20} />, text: 'Settings' },
    ];

    const handlePageClick = (key) => {
        onPageChange(key);
        setMobileMenuOpen(false);
    };

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
                            const isActive = page === link.key;
                            return (
                                <button
                                    key={link.key}
                                    onClick={() => handlePageClick(link.key)}
                                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all group text-base font-medium tracking-wide ${
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
                                    {isActive && <ChevronRight size={14} className="text-white" />}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-orange-100">
                        <div className="text-center text-xs text-gray-400">
                            © 2024 KarigarConnect
                        </div>
                    </div>
                </div>
            </div>

            {/* DESKTOP SIDEBAR */}
            <aside className="hidden lg:flex flex-col w-72 h-[calc(100vh-5rem)] sticky top-20 border-r border-orange-100 bg-gradient-to-b from-orange-50 via-white to-white shadow-sm">
                {/* Scrollable Nav Area */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                    {navLinks.map((link) => {
                        const isActive = page === link.key;
                        return (
                            <button
                                key={link.key}
                                onClick={() => handlePageClick(link.key)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group text-base font-semibold tracking-wide ${
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
                                {isActive && <ChevronRight size={14} className="text-white" />}
                            </button>
                        );
                    })}
                </nav>

                {/* Logout Section - Fixed at bottom */}
                <div className="border-t border-orange-100 p-4">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-orange-100 hover:text-orange-700 rounded-xl transition-all duration-200 font-semibold"
                    >
                        <LogOut size={20} className="text-orange-500" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default ShopSidebar;
