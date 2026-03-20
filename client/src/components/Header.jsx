import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';
import logo from '../assets/logo.jpg';
import NotificationBell from '../components/NotificationBell';

const Header = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');
    const user  = JSON.parse(localStorage.getItem('user') || '{}');

    const [isAvailable,    setIsAvailable]    = useState(true);
    const [dropdownOpen,   setDropdownOpen]   = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

    let dashboardLink = '/';
    if (role === 'worker') dashboardLink = '/worker/dashboard';
    else if (role === 'client') dashboardLink = '/client/dashboard';

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
        toast.success('You have been logged out.');
    };

    const toggleAvailability = async () => {
        const previousState = isAvailable;
        setIsAvailable(!previousState);
        try {
            const { data } = await api.toggleAvailability();
            setIsAvailable(data.availability);
            toast.success(`Availability turned ${data.availability ? 'ON' : 'OFF'}`);
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

    // Shared nav link style — kept exactly as original
    const navLinkClass =
        'relative font-semibold text-gray-700 px-6 py-3 rounded-full bg-gradient-to-r from-orange-100 to-amber-50 border border-orange-200 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 hover:from-orange-200 hover:to-amber-100 group overflow-hidden';

    return (
        <header className="bg-white shadow-md sticky top-0 z-40">
            <nav className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">

                {/* ── LOGO ──────────────────────────────────────────────── */}
                <Link to="/" className="flex items-center space-x-2">
                    <img
                        src={logo}
                        alt="KarigarConnect Logo"
                        className="h-10 w-10 rounded-full border border-gray-300 object-cover"
                    />
                    <span className="hidden md:block relative text-2xl font-black text-orange-500 tracking-tight cursor-default">
                        <span className="relative z-10">KarigarConnect</span>
                        <span className="absolute top-0.5 left-0.5 text-orange-700/30 blur-sm">KarigarConnect</span>
                        <span className="absolute top-0 left-0 text-orange-600/50">KarigarConnect</span>
                    </span>
                </Link>

                {/* ── MOBILE: Bell + Hamburger ─────────────────────────── */}
                <div className="md:hidden flex items-center gap-1">
                    {token && (role === 'worker' || role === 'client') && (
                        <NotificationBell role={role} />
                    )}
                    <button
                        className="p-2 rounded-lg hover:bg-orange-50 transition-colors"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <Menu size={24} className="text-gray-700" />
                    </button>
                </div>

                {/* ── DESKTOP NAV ──────────────────────────────────────── */}
                <div className="hidden md:flex items-center space-x-4 lg:space-x-6">

                    {/* Home */}
                    <Link to="/" className={navLinkClass}>
                        <span className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
                        <span className="relative flex items-center justify-center gap-2">
                            <span>Home</span>
                            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </span>
                    </Link>

                    {token ? (
                        <>
                            {/* Dashboard */}
                            <Link to={dashboardLink} className={navLinkClass}>
                                <span className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-orange-500/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
                                <span className="relative flex items-center justify-center gap-2">
                                    <span className="bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent">Dashboard</span>
                                    <svg className="w-4 h-4 text-gray-700 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V9m0 4h2m-6-4h2m4 0h2m6 0v2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2m6 0V5a2 2 0 012-2h2a2 2 0 012 2v2m-6 0h6" />
                                    </svg>
                                </span>
                            </Link>

                            {/* Worker: availability toggle */}
                            {role === 'worker' && (
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-600">Availability:</span>
                                    <button
                                        onClick={toggleAvailability}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300 ${isAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            )}

                            {/* ── NOTIFICATION BELL — desktop ─────────────── */}
                            {(role === 'worker' || role === 'client') && (
                                <NotificationBell role={role} />
                            )}

                            {/* Profile dropdown */}
                            {(role === 'worker' || role === 'client') && (
                                <div className="relative profile-menu">
                                    <button
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        className="flex items-center space-x-1"
                                    >
                                        <img
                                            src={
                                                user?.photo
                                                    ? (user.photo.startsWith('http') ? user.photo : `http://localhost:5000/${user.photo}`)
                                                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=fb923c&color=fff`
                                            }
                                            alt="Profile"
                                            className="h-9 w-9 rounded-full object-cover border-2 border-orange-200"
                                        />
                                        <ChevronDown size={16} className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {dropdownOpen && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
                                            <div className="px-4 py-2 text-sm text-gray-700 border-b">
                                                <p className="font-bold truncate">{user?.name}</p>
                                                <p className="text-xs text-gray-500">{user?.karigarId}</p>
                                            </div>

                                            {role === 'worker' && (
                                                <>
                                                    <Link to="/worker/profile"  onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50">View Profile</Link>
                                                    <Link to="/worker/id-card"  onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50">View ID Card</Link>
                                                    <Link to="/worker/settings" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50">Settings</Link>
                                                </>
                                            )}

                                            {role === 'client' && (
                                                <Link to="/client/settings" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50">Settings</Link>
                                            )}

                                            <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-orange-50">Logout</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Login */}
                            <Link to="/login" className={navLinkClass}>
                                <span className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-orange-500/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
                                <span className="relative flex items-center justify-center gap-2">
                                    <span className="bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent">Login</span>
                                    <svg className="w-4 h-4 text-gray-700 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                </span>
                            </Link>

                            {/* Register */}
                            <Link to="/register" className={navLinkClass}>
                                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 rounded-full" />
                                <span className="relative flex items-center justify-center gap-2">
                                    <span>Get Started</span>
                                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </span>
                            </Link>
                        </>
                    )}
                </div>

                {/* ── MOBILE MENU DROPDOWN ─────────────────────────────── */}
                {mobileMenuOpen && (
                    <div className="absolute top-full left-0 right-0 bg-white shadow-lg border-t border-gray-200 md:hidden z-50">
                        <div className="container mx-auto px-4 py-4 space-y-4">

                            <Link
                                to="/"
                                onClick={() => setMobileMenuOpen(false)}
                                className="block font-semibold text-gray-700 px-4 py-3 rounded-lg bg-orange-50 border border-orange-200 transition-all duration-300"
                            >
                                Home
                            </Link>

                            {token ? (
                                <>
                                    <Link
                                        to={dashboardLink}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block font-medium text-gray-600 px-4 py-3 rounded-lg hover:bg-orange-50 transition-colors"
                                    >
                                        Dashboard
                                    </Link>

                                    {role === 'worker' && (
                                        <div className="flex items-center justify-between px-4 py-3">
                                            <span className="text-sm font-medium">Availability:</span>
                                            <button
                                                onClick={toggleAvailability}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    )}

                                    {(role === 'worker' || role === 'client') && (
                                        <div className="border-t border-gray-200 pt-4">
                                            <div className="px-4 py-2 text-sm text-gray-700">
                                                <p className="font-bold">{user?.name}</p>
                                                <p className="text-xs text-gray-500">{user?.karigarId}</p>
                                            </div>

                                            {role === 'worker' && (
                                                <>
                                                    <Link to="/worker/profile"  onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-gray-700 hover:bg-orange-50">View Profile</Link>
                                                    <Link to="/worker/id-card"  onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-gray-700 hover:bg-orange-50">View ID Card</Link>
                                                    <Link to="/worker/settings" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-gray-700 hover:bg-orange-50">Settings</Link>
                                                </>
                                            )}

                                            {role === 'client' && (
                                                <Link to="/client/settings" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-gray-700 hover:bg-orange-50">Settings</Link>
                                            )}

                                            <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-red-600 hover:bg-orange-50">Logout</button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block font-semibold text-gray-700 px-4 py-3 rounded-lg bg-orange-50 border border-orange-200 text-center"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        to="/register"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block font-semibold text-gray-700 px-4 py-3 rounded-lg bg-orange-100 border border-orange-300 text-center"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>
        </header>
    );
};

export default Header;