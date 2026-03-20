import React from 'react';
import { Link } from 'react-router-dom';
import { User, Briefcase, Sparkles, ArrowRight, Star } from 'lucide-react';

const Register = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                {/* Header Section */}
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-4">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-3 rounded-full">
                            <Sparkles className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <h2 className="text-4xl font-bold text-gray-800 mb-3">Join KarigarConnect</h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Where skilled professionals and clients come together
                    </p>
                </div>

                {/* Role Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    {/* Worker Card */}
                    <Link 
                        to="/register/worker" 
                        className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 ease-in-out transform hover:-translate-y-2 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        <div className="p-8 relative z-10">
                            <div className="flex justify-center mb-6">
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 rounded-2xl shadow-md group-hover:scale-110 transition-transform duration-300">
                                    <Briefcase className="h-12 w-12 text-white" />
                                </div>
                            </div>
                            
                            <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-orange-600 transition-colors duration-300">
                                I am a Karigar
                            </h3>
                            
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                Showcase your skills, find rewarding projects, and build your professional reputation with clients who value quality work.
                            </p>
                            
                            <div className="flex items-center justify-center text-orange-600 group-hover:text-orange-700 transition-colors duration-300">
                                <span className="font-semibold">Get Started</span>
                                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                            </div>
                        </div>
                        
                        {/* Decorative elements */}
                        <div className="absolute top-4 right-4 opacity-10">
                            <Star className="h-16 w-16 text-orange-500" />
                        </div>
                    </Link>

                    {/* Client Card */}
                    <Link 
                        to="/register/client" 
                        className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 ease-in-out transform hover:-translate-y-2 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        <div className="p-8 relative z-10">
                            <div className="flex justify-center mb-6">
                                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4 rounded-2xl shadow-md group-hover:scale-110 transition-transform duration-300">
                                    <User className="h-12 w-12 text-white" />
                                </div>
                            </div>
                            
                            <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition-colors duration-300">
                                I am a Client
                            </h3>
                            
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                Find verified, skilled professionals for your projects. Get quality work done with transparent pricing and reliable service.
                            </p>
                            
                            <div className="flex items-center justify-center text-blue-600 group-hover:text-blue-700 transition-colors duration-300">
                                <span className="font-semibold">Find Karigars</span>
                                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                            </div>
                        </div>
                        
                        {/* Decorative elements */}
                        <div className="absolute top-4 right-4 opacity-10">
                            <Star className="h-16 w-16 text-blue-500" />
                        </div>
                    </Link>
                </div>

                {/* Benefits Section */}
              

                {/* Login Link */}
                <div className="text-center">
                    <p className="text-gray-600">
                        Already have an account?{' '}
                        <Link 
                            to="/login" 
                            className="font-semibold text-orange-600 hover:text-orange-700 transition-colors duration-300 underline underline-offset-4 hover:underline-offset-2"
                        >
                            Login here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;