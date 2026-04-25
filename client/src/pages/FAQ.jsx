import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, HelpCircle, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import FaqAccordion from '../components/FaqAccordion';
import faqData from '../constants/faqData';

const FAQ = () => {
    const highlights = [
        {
            icon: HelpCircle,
            title: 'Quick answers',
            description: 'Find the most common questions about registration, hiring, and platform usage in one place.',
        },
        {
            icon: ShieldCheck,
            title: 'Trusted flow',
            description: 'The FAQ reflects the platform’s verification and support workflow for clients, workers, and shops.',
        },
        {
            icon: MessageCircleQuestion,
            title: 'Support-aware',
            description: 'If you still need help, the app routes users toward the correct support or complaint flow.',
        },
    ];

    return (
        <main className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-amber-50">
            <section className="relative overflow-hidden border-b border-orange-100">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.14),_transparent_35%)]" />
                <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45 }}
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur"
                    >
                        <HelpCircle className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-semibold text-orange-700">FAQ</span>
                    </motion.div>

                    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                        <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.05 }}
                        >
                            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                                Frequently asked questions, answered clearly.
                            </h1>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">
                                Use this page to understand how KarigarConnect works across registration, jobs,
                                verification, support, and platform features.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link
                                    to="/home"
                                    className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-900/20 transition hover:-translate-y-0.5 hover:bg-gray-800"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back to home
                                </Link>
                                <a
                                    href="#faq-list"
                                    className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-5 py-3 text-sm font-semibold text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50"
                                >
                                    Jump to questions
                                </a>
                            </div>
                        </motion.div>

                        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                            {highlights.map((item, index) => {
                                const Icon = item.icon;

                                return (
                                    <motion.div
                                        key={item.title}
                                        initial={{ opacity: 0, x: 24 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.4, delay: 0.08 + index * 0.06 }}
                                        className="rounded-3xl border border-orange-100 bg-white/90 p-5 shadow-xl shadow-orange-100/40 backdrop-blur"
                                    >
                                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-900">{item.title}</h2>
                                        <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            <section id="faq-list" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                <div className="mb-8 max-w-3xl">
                    <p className="text-sm font-bold uppercase tracking-[0.28em] text-orange-600">Questions</p>
                    <h2 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
                        Everything you need to know about the platform.
                    </h2>
                    <p className="mt-4 text-base leading-7 text-gray-600">
                        These answers cover the most common flows for clients, workers, shop owners, and admins.
                    </p>
                </div>

                <FaqAccordion items={faqData} className="space-y-4" />
            </section>
        </main>
    );
};

export default FAQ;