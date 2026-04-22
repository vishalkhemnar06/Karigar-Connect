// client/src/pages/auth/Register.jsx
// UPDATED: Added Shop Owner registration card, professional layout

import React from 'react';
import { Link } from 'react-router-dom';
import { User, Briefcase, Sparkles, ArrowRight, Star, Store, Shield } from 'lucide-react';

const CARDS = [
    {
        to: '/register/worker',
        icon: Briefcase,
        iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500',
        title: 'I am a Karigar',
        titleHover: 'group-hover:text-orange-600',
        ctaColor: 'text-orange-600 group-hover:text-orange-700',
        starColor: 'text-orange-400',
        hoverBg: 'from-orange-500/5 to-amber-500/5',
        cta: 'Get Started',
        desc: 'Showcase your skills, find rewarding projects, and build your professional reputation with clients who value quality work.',
    },
    {
        to: '/register/client',
        icon: User,
        iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
        title: 'I am a Client',
        titleHover: 'group-hover:text-blue-600',
        ctaColor: 'text-blue-600 group-hover:text-blue-700',
        starColor: 'text-blue-400',
        hoverBg: 'from-blue-500/5 to-cyan-500/5',
        cta: 'Find Karigars',
        desc: 'Find verified, skilled professionals for your projects. Get quality work done with transparent pricing and reliable service.',
    },
    {
        to: '/shop/register',
        icon: Store,
        iconBg: 'bg-gradient-to-br from-teal-500 to-emerald-500',
        title: 'I am a Shop Owner',
        titleHover: 'group-hover:text-teal-600',
        ctaColor: 'text-teal-600 group-hover:text-teal-700',
        starColor: 'text-teal-400',
        hoverBg: 'from-teal-500/5 to-emerald-500/5',
        cta: 'Register Shop',
        desc: 'Register your tool or hardware shop and offer exclusive discounts to verified workers through the KarigarConnect coupon system.',
        badge: 'New',
    },
];

const Register = () => (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="max-w-5xl w-full">
            {/* Header */}
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl mb-5 shadow-lg shadow-orange-200">
                    <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">Join KarigarConnect</h1>
                <p className="text-lg text-gray-500 mt-3 max-w-xl mx-auto">
                    Where skilled professionals, clients, and shop owners come together
                </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {CARDS.map((card) => {
                    const IconComp = card.icon;
                    return (
                        <Link key={card.to} to={card.to}
                            className="group relative bg-white rounded-3xl shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden border border-gray-100">
                            {/* Hover overlay */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${card.hoverBg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                           

                            <div className="relative z-10 p-8">
                                {/* Icon */}
                                <div className={`inline-flex p-4 rounded-2xl ${card.iconBg} shadow-md mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                    <IconComp className="h-10 w-10 text-white" />
                                </div>

                                <h3 className={`text-2xl font-black text-gray-800 mb-3 transition-colors duration-300 ${card.titleHover}`}>
                                    {card.title}
                                </h3>

                                <p className="text-gray-500 mb-7 leading-relaxed text-[15px]">{card.desc}</p>

                                <div className={`flex items-center font-bold transition-colors duration-300 ${card.ctaColor}`}>
                                    <span>{card.cta}</span>
                                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1.5 transition-transform duration-300" />
                                </div>
                            </div>

                            {/* Decorative star */}
                            <div className="absolute top-4 right-4 opacity-[0.07]">
                                <Star className={`h-20 w-20 ${card.starColor}`} />
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Login links */}
            <div className="text-center space-y-2">
                <p className="text-gray-600 text-sm">
                    Already have an account?{' '}
                    <Link to="/login"
                        className="font-black text-orange-600 hover:text-orange-700 transition-colors underline underline-offset-4">
                        Login here
                    </Link>
                </p>
                
            </div>
        </div>
    </div>
);

export default Register;