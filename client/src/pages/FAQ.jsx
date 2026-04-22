import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenText, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import faqData from '../constants/faqData';
import FaqAccordion from '../components/FaqAccordion';

const FAQ = () => {
    const stats = [
        { label: 'Questions covered', value: faqData.length },
        { label: 'User roles', value: '3+' },
        { label: 'Support focus', value: 'Always on' },
    ];

    const pillars = [
        {
            icon: BookOpenText,
            title: 'Project overview',
            description: 'Learn how clients, workers, shops, and admins use the platform together.'
        },
        {
            icon: ShieldCheck,
            title: 'Trusted workflows',
            description: 'Understand verification, complaints, and the safety controls built into the app.'
        },
        {
            icon: MessageCircle,
            title: 'Support and access',
            description: 'Find the right route for help, language support, and quick guidance.'
        },
    ];

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_35%),linear-gradient(180deg,#fffaf5_0%,#fff_40%,#fff7ed_100%)]">
            <section className="relative overflow-hidden px-4 pt-20 pb-12 sm:px-6 lg:px-8">
                <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-orange-400/20 blur-3xl" />
                <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                    <div>
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm backdrop-blur">
                            <Sparkles size={16} />
                            Frequently Asked Questions
                        </div>
                        <h1 className="max-w-2xl text-4xl font-black tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                            Everything users need to know about KarigarConnect
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
                            This page collects the main questions about registration, job flow, shop tools, live tracking, pricing, support, and the role-based features inside the project.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                to="/home"
                                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5"
                            >
                                Back to Home
                                <ArrowRight size={16} />
                            </Link>
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-5 py-3 text-sm font-bold text-orange-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                            >
                                Join the platform
                            </Link>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                            {stats.map((stat) => (
                                <div key={stat.label} className="rounded-3xl border border-orange-100 bg-white p-5 shadow-lg shadow-orange-100/50">
                                    <p className="text-3xl font-black text-gray-900">{stat.value}</p>
                                    <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-[2rem] border border-orange-100 bg-gradient-to-br from-orange-500 to-amber-500 p-6 text-white shadow-2xl shadow-orange-200">
                            <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-100">Need help faster?</p>
                            <h2 className="mt-3 text-2xl font-black">Use the contact details from the home page for direct support.</h2>
                            <p className="mt-3 text-sm leading-7 text-orange-50/90">
                                The FAQ gives the core answers, while the contact section is best for direct calls, emails, or project-specific support.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-4 pb-20 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8 grid gap-4 md:grid-cols-3">
                        {pillars.map((pillar, index) => {
                            const Icon = pillar.icon;
                            return (
                                <div key={pillar.title} className="rounded-3xl border border-white bg-white/80 p-5 shadow-lg shadow-orange-100/40 backdrop-blur">
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200">
                                        <Icon size={22} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">{pillar.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-gray-600">{pillar.description}</p>
                                </div>
                            );
                        })}
                    </div>

                    <FaqAccordion items={faqData} />
                </div>
            </section>
        </div>
    );
};

export default FAQ;