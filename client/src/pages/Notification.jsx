import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Shield, CheckCircle, Mail } from 'lucide-react';

const Notification = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:shadow-3xl">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
                    <div className="flex items-center justify-center space-x-3">
                        <div className="relative">
                            <Shield className="h-8 w-8" />
                            <Clock className="h-4 w-4 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
                        </div>
                        <h1 className="text-2xl font-bold">Verification in Progress</h1>
                    </div>
                </div>

                {/* Animated progress section */}
                <div className="p-8">
                    {/* Animated progress indicator */}
                    <div className="relative mb-8">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-3 rounded-full animate-pulse w-3/4"></div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 mt-2">
                            <span>Submitted</span>
                            <span>Reviewing</span>
                            <span className="text-blue-600 font-semibold">Verified</span>
                        </div>
                    </div>

                    {/* Main content */}
                    <div className="text-center mb-8">
                        <div className="relative inline-block mb-6">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                                <Mail className="h-10 w-10 text-blue-600" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-yellow-400 rounded-full p-1">
                                <Clock className="h-5 w-5 text-white animate-spin" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            We're Reviewing Your Profile
                        </h2>
                        
                        <p className="text-gray-600 leading-relaxed mb-6">
                            Thank you for submitting your profile! Our team is carefully reviewing 
                            your information to ensure everything meets our standards.
                        </p>

                        {/* Features list */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-6">
                            <div className="flex items-center justify-center space-x-4 text-sm">
                                <div className="flex items-center space-x-1">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-gray-700">Security Check</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-gray-700">Document Review</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Clock className="h-4 w-4 text-yellow-500" />
                                    <span className="text-gray-700">Final Approval</span>
                                </div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                            <div className="flex items-center justify-between text-sm">
                                <div className="text-center">
                                    <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
                                    <span className="text-gray-600">Submitted</span>
                                </div>
                                <div className="text-center">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-1 animate-pulse"></div>
                                    <span className="text-gray-800 font-semibold">Reviewing</span>
                                </div>
                                <div className="text-center">
                                    <div className="w-3 h-3 bg-gray-300 rounded-full mx-auto mb-1"></div>
                                    <span className="text-gray-600">Completed</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            ⏰ You'll receive a notification within <span className="font-semibold text-yellow-700">24 hours</span> once the verification is complete.
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col space-y-3">
                        <Link 
                            to="/" 
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-center"
                        >
                            Go to Homepage
                        </Link>
                        <button className="w-full border border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all duration-200">
                            Contact Support
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                        Need help? <a href="mailto:support@example.com" className="text-blue-600 hover:underline">Contact our support team</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Notification;