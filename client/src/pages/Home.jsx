import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.jpg';

const Home = () => {
    const [token, setToken] = useState(null);
    const [role, setRole] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Get auth data from localStorage
        const authToken = localStorage.getItem('token');
        const authRole = localStorage.getItem('role');
        const shopToken = localStorage.getItem('shopToken');
        const shopRole = localStorage.getItem('shopRole');
        
        // Shop owner is logged in
        if (shopToken && shopRole) {
            setToken(shopToken);
            setRole('shop');
        }
        // Other users are logged in
        else if (authToken && authRole) {
            setToken(authToken);
            setRole(authRole);
        }
        
        // Trigger animations after component mounts
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    const dashboardLink = role === 'admin' ? '/admin/dashboard' : 
                         role === 'worker' ? '/worker/dashboard' :
                         role === 'shop' ? '/shop/dashboard' :
                         '/client/dashboard';

    // Features data
    const features = [
        {
            icon: '🔍',
            title: 'Find Skilled Karigars',
            description: 'Connect with verified professionals for all your needs'
        },
        {
            icon: '💼',
            title: 'Grow Your Business',
            description: 'Get more visibility and clients for your services'
        },
        {
            icon: '⭐',
            title: 'Rate & Review',
            description: 'Share your experience and help others make decisions'
        },
        {
            icon: '💰',
            title: 'Fair Pricing',
            description: 'Transparent costs with no hidden charges'
        }
    ];

    {/* IVR Callout for Workers */}
    {role === 'worker' && (
        <div className="max-w-2xl mx-auto mt-10 mb-8">
            <div className="bg-gradient-to-r from-orange-100 to-orange-200 border-2 border-orange-300 rounded-2xl p-6 flex flex-col items-center shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">📞</span>
                    <span className="text-lg font-bold text-orange-700">IVR Worker Helpline</span>
                </div>
                <a href="tel:+18147403875" className="text-2xl font-extrabold text-orange-600 underline hover:text-orange-800 transition-colors mb-2">+1 814-740-3875</a>
                <ul className="text-sm text-gray-700 list-disc pl-5 text-left">
                    <li>Call to get update on your availability</li>
                    <li>Know about nearby jobs</li>
                    <li>Registration process guidance</li>
                    <li>Profile summary and status</li>
                </ul>
                <div className="mt-2 text-xs text-gray-500">This number is for workers only.</div>
            </div>
        </div>
    )}

    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-orange-50">
            {/* Hero Section */}
            <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center">
                        <h1 className={`text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                            Welcome to <span className="text-orange-600">KarigarConnect</span>
                        </h1>
                        <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto transition-all duration-1000 delay-300" style={{ opacity: isVisible ? 1 : 0 }}>
                            {token 
                                ? "Your central hub for managing your work and connections." 
                                : "The trusted network connecting skilled workers with local communities."
                            }
                        </p>
                        
                        <div className="mt-12 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6 transition-all duration-1000 delay-500" style={{ opacity: isVisible ? 1 : 0 }}>
                            {token ? (
                                <Link
                                    to={dashboardLink}
                                    className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                                >
                                    Go to Your Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="px-8 py-4 bg-white text-orange-600 border-2 border-orange-500 font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                                    >
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>

                        {!token && (
                            <div className="mt-6 flex justify-center transition-all duration-1000 delay-700" style={{ opacity: isVisible ? 1 : 0 }}>
                                <Link
                                    to="/check-status"
                                    className="px-8 py-3 bg-orange-50 text-orange-600 font-semibold rounded-xl border-2 border-orange-300 hover:bg-orange-100 hover:border-orange-400 shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
                                >
                                    Know Your Application Status
                                </Link>
                            </div>
                        )}
                    </div>
                    
                    {/* Hero Image */}
                    <div className="mt-16 flex justify-center transition-all duration-1000 delay-700" style={{ opacity: isVisible ? 1 : 0 }}>
                        <div className="relative w-full max-w-4xl">
                            <div className="absolute -inset-4 bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl blur opacity-30"></div>
                            <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden">
                                <div className="aspect-w-16 aspect-h-9 md:aspect-h-7 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center p-8">
                                    <div className="text-center">
                                        <div className="text-5xl mb-4">👷‍♂️</div>
                                        <h3 className="text-2xl font-bold text-gray-800">Connecting Karigars & Clients</h3>
                                        <p className="mt-2 text-gray-600">Find the perfect match for your needs</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 bg-white px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-extrabold text-gray-900">Why Choose KarigarConnect?</h2>
                        <p className="mt-4 text-xl text-gray-600">We make it easy to connect with skilled professionals</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, index) => (
                            <div 
                                key={index} 
                                className="bg-gradient-to-b from-orange-50 to-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
                                style={{ transitionDelay: `${index * 100}ms` }}
                            >
                                <div className="text-4xl mb-4">{feature.icon}</div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                                <p className="text-gray-600">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
           

            {/* Contact Us Section */}
            <section id="contact" className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-orange-50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">Get In Touch</h2>
                        <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
                            Have questions? We're here to help. Contact us anytime!
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                        {/* Phone Contact Card */}
                        <div className="bg-white rounded-2xl p-8 shadow-lg border border-orange-100 text-center hover:shadow-xl transition-all transform hover:-translate-y-2">
                            <div className="flex justify-center mb-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Phone</h3>
                            <p className="text-gray-600 mb-4">Call us during business hours</p>
                            <a 
                                href="tel:+918605171209"
                                className="text-2xl font-bold text-orange-600 hover:text-orange-700 transition-colors"
                            >
                                +91 8605171209
                            </a>
                        </div>

                        {/* Email Contact Card */}
                        <div className="bg-white rounded-2xl p-8 shadow-lg border border-orange-100 text-center hover:shadow-xl transition-all transform hover:-translate-y-2">
                            <div className="flex justify-center mb-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Email</h3>
                            <p className="text-gray-600 mb-4">Drop us a message anytime</p>
                            <a 
                                href="mailto:kc.india@gmail.com"
                                className="text-lg font-bold text-blue-600 hover:text-blue-700 transition-colors break-all"
                            >
                                kc.india@gmail.com
                            </a>
                        </div>

                        {/* Address Contact Card */}
                        <div className="bg-white rounded-2xl p-8 shadow-lg border border-orange-100 text-center hover:shadow-xl transition-all transform hover:-translate-y-2">
                            <div className="flex justify-center mb-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Address</h3>
                            <p className="text-gray-600 mb-4">Visit us at our office</p>
                            <p className="text-lg font-semibold text-gray-800">
                                Manjari Budruk<br />
                                Hadapsar Road, Manjri<br />
                                Wagholi, Maharashtra 412307<br />
                                <span className="text-sm text-gray-600 mt-2 block">India</span>
                            </p>
                        </div>
                    </div>

                    {/* Additional Contact Info Box */}
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 md:p-12 text-white text-center">
                        <h3 className="text-2xl font-bold mb-4">Need Quick Support?</h3>
                        <p className="text-lg mb-6 max-w-2xl mx-auto">
                            Our dedicated support team is ready to assist you. Whether you have questions about our services or need technical support, 
                            we're just a call or message away.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a 
                                href="tel:+918605171209"
                                className="px-8 py-3 bg-white text-orange-600 font-bold rounded-xl hover:bg-gray-100 transition-all"
                            >
                                Call Us Now
                            </a>
                            <a 
                                href="mailto:kc.india@gmail.com"
                                className="px-8 py-3 bg-orange-700 text-white font-bold rounded-xl hover:bg-orange-800 transition-all"
                            >
                                Send Email
                            </a>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* CTA Section */}
            <section className="py-16 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto text-center">
                    <h2 className="text-3xl font-extrabold">Ready to Get Started?</h2>
                    <p className="mt-4 text-xl max-w-3xl mx-auto">
                        {token 
                            ? "Manage your account and connections from your personalized dashboard." 
                            : "Join thousands of karigars and clients who are already benefiting from our platform."
                        }
                    </p>
                    
                    <div className="mt-8 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                        {token ? (
                            <Link
                                to={dashboardLink}
                                className="px-8 py-4 bg-white text-orange-600 font-semibold rounded-xl shadow-lg hover:bg-gray-100 transform hover:-translate-y-1 transition-all duration-300"
                            >
                                Go to Dashboard
                            </Link>
                        ) : (
                            <>
                           
                               
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gradient-to-b from-gray-900 to-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
                {/* Top Section with Logo and Description */}
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12 pb-12 border-b border-gray-700">
                        {/* Logo and Brand Section */}
                        <div className="col-span-1 md:col-span-1">
                            <Link to="/" className="flex items-center gap-3 mb-4 group">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full blur-md opacity-40 group-hover:opacity-80 transition-opacity" />
                                    <img
                                        src={logo}
                                        alt="KarigarConnect Logo"
                                        className="relative w-12 h-12 rounded-full object-cover border-2 border-orange-300"
                                    />
                                </div>
                                <span className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                                    KarigarConnect™
                                </span>
                            </Link>
                            <p className="text-gray-400 text-sm leading-relaxed mt-4">
                                Transforming the services industry by seamlessly connecting skilled professionals with customers across India.
                            </p>
                            {/* Social Media Links */}
                            <div className="flex gap-4 mt-6">
                                <a 
                                    href="https://facebook.com/KarigarConnect" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-all transform hover:scale-110"
                                    title="Facebook"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                </a>
                                <a 
                                    href="https://instagram.com/KarigarConnect" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-all transform hover:scale-110"
                                    title="Instagram"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.322a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z"/>
                                    </svg>
                                </a>
                                <a 
                                    href="https://twitter.com/KarigarConnect" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-all transform hover:scale-110"
                                    title="Twitter"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M23.953 4.57a10 10 0 002.856-3.51 10.05 10.05 0 01-2.917.113 5.007 5.007 0 00.898-5.646c-.84.504-1.735.857-2.675 1.013a5.013 5.013 0 00-8.657 4.566 14.142 14.142 0 01-10.28-5.221 4.96 4.96 0 00-.669 2.522c0 1.74.888 3.27 2.231 4.169a4.943 4.943 0 01-2.267-.616v.06a5.006 5.006 0 004.014 4.905 5.006 5.006 0 01-2.251.086 5.007 5.007 0 004.674 3.479A10.007 10.007 0 012 19.892a14.118 14.118 0 007.67 2.245c9.203 0 14.23-7.543 14.23-14.08 0-.213-.005-.426-.015-.637A10.025 10.025 0 0024 4.59z"/>
                                    </svg>
                                </a>
                            </div>
                        </div>

                        {/* Quick Links */}
                        <div>
                            <h3 className="text-lg font-bold mb-6 text-white">Quick Links</h3>
                            <ul className="space-y-3">
                                <li><a href="#about-us" className="text-gray-400 hover:text-orange-400 transition-colors">About Us</a></li>
                                <li><a href="#contact" className="text-gray-400 hover:text-orange-400 transition-colors">Contact Us</a></li>
                                <li><Link to="/" className="text-gray-400 hover:text-orange-400 transition-colors">Home</Link></li>
                                <li><a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">Find Workers</a></li>
                            </ul>
                        </div>

                        {/* Policies & Information */}
                        <div>
                            <h3 className="text-lg font-bold mb-6 text-white">Company</h3>
                            <ul className="space-y-3">
                                <li><Link to="/terms-and-conditions" className="text-gray-400 hover:text-orange-400 transition-colors">Terms & Conditions</Link></li>
                                <li><Link to="/privacy-policy" className="text-gray-400 hover:text-orange-400 transition-colors">Privacy Policy</Link></li>
                                <li><a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">Cancellation Policy</a></li>
                                <li><a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">Refund Policy</a></li>
                                <li><a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">Disclaimer</a></li>
                            </ul>
                        </div>

                        {/* Contact Information */}
                        <div>
                            <h3 className="text-lg font-bold mb-6 text-white">Contact Info</h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-orange-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <div>
                                        <p className="text-gray-300 text-sm font-semibold">Phone</p>
                                        <a href="tel:+918605171209" className="text-gray-400 hover:text-orange-400 transition-colors">
                                            +91 8605171209
                                        </a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-orange-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <div>
                                        <p className="text-gray-300 text-sm font-semibold">Email</p>
                                        <a href="mailto:kc.india@gmail.com" className="text-gray-400 hover:text-orange-400 transition-colors break-all">
                                            kc.india@gmail.com
                                        </a>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Address Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 pb-12 border-b border-gray-700">
                        {/* Corporate Address */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z" />
                                </svg>
                                Corporate Address
                            </h3>
                            <p className="text-gray-300 leading-relaxed">
                                Manjari Budruk<br />
                                Hadapsar Road, Manjri<br />
                                Wagholi, Maharashtra 412307<br />
                                <span className="text-sm text-gray-400">India</span>
                            </p>
                        </div>

                        {/* Registered Address */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z" />
                                </svg>
                                Registered Address
                            </h3>
                            <p className="text-gray-300 leading-relaxed">
                                Manjari Budruk<br />
                                Hadapsar Road, Manjri<br />
                                Wagholi, Maharashtra 412307<br />
                                <span className="text-sm text-gray-400">India</span>
                            </p>
                        </div>
                    </div>

                    {/* Bottom Section - Copyright */}
                    <div className="text-center py-8 border-t border-gray-700">
                        <p className="text-gray-400 text-sm">
                            &copy; {new Date().getFullYear()} KarigarConnect™. All rights reserved. | One nation, One labour chowk
                        </p>
                        <p className="text-gray-500 text-xs mt-4">
                            Designed & Developed with <span className="text-orange-400">❤</span> in India
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;