import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
    const [token, setToken] = useState(null);
    const [role, setRole] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Get auth data from localStorage
        const authToken = localStorage.getItem('token');
        const authRole = localStorage.getItem('role');
        
        setToken(authToken);
        setRole(authRole);
        
        // Trigger animations after component mounts
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    const dashboardLink = role === 'admin' ? '/admin/dashboard' : 
                         role === 'worker' ? '/worker/dashboard' : 
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
            
            {/* Testimonials Section */}
            <section className="py-16 bg-gradient-to-b from-orange-50 to-orange-100 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-extrabold text-gray-900">What Our Users Say</h2>
                        <p className="mt-4 text-xl text-gray-600">Hear from karigars and clients who use our platform</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white rounded-2xl p-6 shadow-md">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                                    R
                                </div>
                                <div>
                                    <h4 className="font-semibold">Rajesh Kumar</h4>
                                    <p className="text-orange-600 text-sm">Carpenter</p>
                                </div>
                            </div>
                            <p className="text-gray-600">"KarigarConnect has helped me find consistent work and build my reputation. My income has doubled since joining!"</p>
                        </div>
                        
                        <div className="bg-white rounded-2xl p-6 shadow-md">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                                    P
                                </div>
                                <div>
                                    <h4 className="font-semibold">Priya Sharma</h4>
                                    <p className="text-orange-600 text-sm">Client</p>
                                </div>
                            </div>
                            <p className="text-gray-600">"I found the perfect electrician for my home renovation through KarigarConnect. The process was smooth and hassle-free."</p>
                        </div>
                        
                        <div className="bg-white rounded-2xl p-6 shadow-md">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                                    A
                                </div>
                                <div>
                                    <h4 className="font-semibold">Amit Patel</h4>
                                    <p className="text-orange-600 text-sm">Plumber</p>
                                </div>
                            </div>
                            <p className="text-gray-600">"The platform is easy to use and has helped me grow my customer base significantly. Highly recommend to all karigars!"</p>
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
        </div>
    );
};

export default Home;