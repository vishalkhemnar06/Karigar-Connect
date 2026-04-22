import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    WandSparkles,
    ChevronLeft,
    ChevronRight,
    X,
    Navigation,
    Languages,
} from 'lucide-react';
import { useWorkerOnboarding } from '../context/WorkerOnboardingContext';

const STEPS = [
    {
        title: 'Navbar: Home',
        description: 'This is the Home navigation in your top bar.',
        howItWorks: 'Use it anytime to quickly jump to main landing area.',
        selector: '[data-guide-id="worker-navbar-home"]',
        route: '/worker/dashboard',
        icon: Navigation,
    },
    {
        title: 'Navbar: Dashboard',
        description: 'This dashboard shortcut in navbar opens your worker home panel.',
        howItWorks: 'Use it to quickly return to the worker dashboard from any page.',
        selector: '[data-guide-id="worker-navbar-dashboard"]',
        route: '/worker/dashboard',
    },
    {
        title: 'Navbar: Language',
        description: 'Change language from navbar while guide is open.',
        howItWorks: 'Select your preferred language and continue guide in that language.',
        selector: '[data-guide-id="worker-navbar-language"]',
        route: '/worker/dashboard',
        icon: Languages,
    },
    {
        title: 'Dashboard Page',
        description: 'Live worker summary with analytics and quick actions.',
        howItWorks: 'Check this page first daily to track status, points, and performance.',
        selector: '[data-guide-id="worker-page-dashboard"]',
        route: '/worker/dashboard',
    },
    {
        title: 'Job Requests Page',
        description: 'Browse available client jobs and apply for suitable work.',
        howItWorks: 'Filter jobs, check details, and submit applications from this page.',
        selector: '[data-guide-id="worker-page-job-requests"]',
        route: '/worker/job-requests',
    },
    {
        title: 'My Bookings Page',
        description: 'Track all assigned and accepted jobs.',
        howItWorks: 'Use this page to manage active, pending, and completed bookings.',
        selector: '[data-guide-id="worker-page-job-bookings"]',
        route: '/worker/job-bookings',
    },
    {
        title: 'Direct Invites Page',
        description: 'See jobs where clients invited you directly.',
        howItWorks: 'Review invite details and respond quickly to improve conversion.',
        selector: '[data-guide-id="worker-page-direct-invites"]',
        route: '/worker/direct-invites',
    },
    {
        title: 'Shops Page',
        description: 'Explore partner shops, tools, coupons, and map view.',
        howItWorks: 'Use search/filter and coupons to purchase tools smarter.',
        selector: '[data-guide-id="worker-page-shops"]',
        route: '/worker/shops',
    },
    {
        title: 'Community Page',
        description: 'Share posts and interact with other karigars.',
        howItWorks: 'Create posts, engage with likes/comments, and stay connected.',
        selector: '[data-guide-id="worker-page-community"]',
        route: '/worker/community',
    },
    {
        title: 'Create Group Page',
        description: 'Create worker teams for collaboration and group jobs.',
        howItWorks: 'Enter group details and add members to start team-based work.',
        selector: '[data-guide-id="worker-page-create-group"]',
        route: '/worker/create-group',
    },
    {
        title: 'My Groups Page',
        description: 'Manage your created/joined groups and activity.',
        howItWorks: 'Use this page to monitor team roles, members, and group status.',
        selector: '[data-guide-id="worker-page-my-groups"]',
        route: '/worker/my-groups',
    },
    {
        title: 'Leaderboard Page',
        description: 'Check top workers and your ranking position.',
        howItWorks: 'Use it to measure progress and improve your performance score.',
        selector: '[data-guide-id="worker-page-leaderboard"]',
        route: '/worker/leaderboard',
    },
    {
        title: 'Feedback Page',
        description: 'View ratings and client feedback received on jobs.',
        howItWorks: 'Review strengths and improvement points from real client reviews.',
        selector: '[data-guide-id="worker-page-feedback"]',
        route: '/worker/feedback',
    },
    {
        title: 'Work History Page',
        description: 'See completed jobs and historical records.',
        howItWorks: 'Use this page for tracking your work timeline and outcomes.',
        selector: '[data-guide-id="worker-page-history"]',
        route: '/worker/history',
    },
    {
        title: 'Profile Page',
        description: 'Update personal/professional profile and documents.',
        howItWorks: 'Maintain profile quality to build trust and get better opportunities.',
        selector: '[data-guide-id="worker-page-profile"]',
        route: '/worker/profile',
    },
    {
        title: 'Support Page',
        description: 'Raise complaints or ask help from support team.',
        howItWorks: 'Track conversation thread and updates from support here.',
        selector: '[data-guide-id="worker-page-support"]',
        route: '/worker/complaints',
    },
    {
        title: 'Settings Page',
        description: 'This is your final step for account and security controls.',
        howItWorks: 'From here, manage security and restart the User Guide anytime.',
        selector: '[data-guide-id="worker-page-settings"]',
        route: '/worker/settings',
    },
];

function findVisibleElement(selector) {
    const elements = Array.from(document.querySelectorAll(selector));
    return elements.find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }) || null;
}

export default function WorkerOnboardingModal() {
    const navigate = useNavigate();
    const location = useLocation();

    const {
        isOpen,
        currentStep,
        setCurrentStep,
        skipGuide,
        finishGuide,
        closeGuide,
    } = useWorkerOnboarding();

    const totalSteps = STEPS.length;
    const safeStep = Math.min(Math.max(currentStep, 0), totalSteps - 1);
    const step = STEPS[safeStep];
    const progress = ((safeStep + 1) / totalSteps) * 100;
    const isFirst = safeStep === 0;
    const isLast = safeStep === totalSteps - 1;

    useEffect(() => {
        if (currentStep > totalSteps - 1) {
            setCurrentStep(totalSteps - 1);
        }
    }, [currentStep, setCurrentStep, totalSteps]);

    const goNext = () => {
        if (isLast) {
            finishGuide();
            return;
        }
        setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    };

    const goBack = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const [targetRect, setTargetRect] = useState(null);

    const Icon = step?.icon || WandSparkles;

    useEffect(() => {
        if (!isOpen || !step) return;

        if (step.route && location.pathname !== step.route) {
            navigate(step.route);
            return;
        }

        const refreshRect = () => {
            const target = findVisibleElement(step.selector);
            if (!target) {
                setTargetRect(null);
                return;
            }
            const rect = target.getBoundingClientRect();
            setTargetRect({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            });
        };

        const delayed = setTimeout(refreshRect, 140);
        window.addEventListener('resize', refreshRect);
        window.addEventListener('scroll', refreshRect, true);

        return () => {
            clearTimeout(delayed);
            window.removeEventListener('resize', refreshRect);
            window.removeEventListener('scroll', refreshRect, true);
        };
    }, [isOpen, step, location.pathname, navigate]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {targetRect && (
                        <motion.div
                            className="fixed z-[9994] pointer-events-none rounded-xl border-2 border-orange-500"
                            initial={false}
                            animate={{
                                top: targetRect.top - 6,
                                left: targetRect.left - 6,
                                width: targetRect.width + 12,
                                height: targetRect.height + 12,
                            }}
                            transition={{ duration: 0.18 }}
                        />
                    )}

                    <motion.div
                        className="fixed z-[9996] w-[min(420px,calc(100vw-16px))] bg-white rounded-2xl border border-orange-100 shadow-2xl"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0, right: 12, bottom: 12 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-orange-50 via-white to-white rounded-t-2xl">
                            <button
                                type="button"
                                onClick={closeGuide}
                                className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white"
                                aria-label="Hide guide"
                            >
                                <X size={16} />
                            </button>

                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                                    <Icon size={16} />
                                </div>
                                <p className="text-xs font-bold tracking-widest uppercase text-gray-500">Step {safeStep + 1} of {totalSteps}</p>
                            </div>

                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                                <motion.div className="h-full bg-gradient-to-r from-orange-500 to-amber-500" animate={{ width: `${progress}%` }} />
                            </div>

                            <h3 className="text-lg font-black text-gray-900 leading-tight">{step.title}</h3>
                            <p className="mt-2 text-sm text-gray-700">{step.description}</p>
                            <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-3">
                                <p className="text-[11px] font-black uppercase tracking-wide text-orange-700">How It Works</p>
                                <p className="text-sm text-orange-900 mt-1">{step.howItWorks}</p>
                            </div>
                            {!targetRect && (
                                <p className="mt-2 text-xs text-amber-700">Target item is not visible. Scroll or open menu to continue this step.</p>
                            )}
                        </div>

                        <div className="p-4 sm:p-5 pt-3 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={isFirst ? skipGuide : goBack}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                            >
                                {isFirst ? 'Skip' : <><ChevronLeft size={15} />Back</>}
                            </button>

                            <button
                                type="button"
                                onClick={goNext}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-black"
                            >
                                {isLast ? 'Finish' : 'Next'}
                                {!isLast && <ChevronRight size={15} />}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
