import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Home, LayoutDashboard, Languages, Sparkles, Briefcase, PlusSquare, History, Heart, Users, AlertTriangle, User, Settings, CheckCircle2 } from 'lucide-react';
import { useClientOnboarding } from '../context/ClientOnboardingContext';

const STEPS = [
    { title: 'Navbar Home', description: 'This is the main home link in the navbar.', howItWorks: 'Use it to return to the platform landing area anytime.', selector: '[data-guide-id-client="client-navbar-home"]', route: '/client/dashboard', icon: Home },
    { title: 'Navbar Dashboard', description: 'Quick access to your client dashboard from the top bar.', howItWorks: 'Use it to jump back to your main client overview.', selector: '[data-guide-id-client="client-navbar-dashboard"]', route: '/client/dashboard', icon: LayoutDashboard },
    { title: 'Navbar Language', description: 'Change language anytime while the guide stays open.', howItWorks: 'Select your preferred language first, then continue the guide in that language.', selector: '[data-guide-id-client="client-navbar-language"]', route: '/client/dashboard', icon: Languages },
    { title: 'Dashboard', description: 'See your jobs, activity, and recommendations.', howItWorks: 'Start here to understand your current work status at a glance.', selector: '[data-guide-id="client-page-dashboard"]', route: '/client/dashboard', icon: Sparkles },
    { title: 'AI Tool', description: 'Plan jobs and get smart assistance with your requirements.', howItWorks: 'Use AI Tool to draft better job posts and manage work faster.', selector: '[data-guide-id="client-page-ai-assist"]', route: '/client/ai-assist', icon: Sparkles },
    { title: 'Post Job', description: 'Create a new job request for workers.', howItWorks: 'Fill in the form and publish a job when you need help.', selector: '[data-guide-id="client-page-job-post"]', route: '/client/job-post', icon: PlusSquare },
    { title: 'Manage Jobs', description: 'Track and control all your posted jobs.', howItWorks: 'Use this page to review applications and manage progress.', selector: '[data-guide-id="client-page-job-manage"]', route: '/client/job-manage', icon: Briefcase },
    { title: 'History', description: 'See your completed jobs and past activity.', howItWorks: 'Review history to understand what has already been done.', selector: '[data-guide-id="client-page-history"]', route: '/client/history', icon: History },
    { title: 'Favorites', description: 'Keep preferred workers saved for faster hiring.', howItWorks: 'Open this to revisit trusted workers quickly.', selector: '[data-guide-id="client-page-favorites"]', route: '/client/favorites', icon: Heart },
    { title: 'Groups', description: 'Browse worker groups for larger jobs.', howItWorks: 'Use groups when you need a team instead of one worker.', selector: '[data-guide-id="client-page-groups"]', route: '/client/groups', icon: Users },
    { title: 'Complaints', description: 'Raise and track issues or support requests.', howItWorks: 'Use this section to file issues and follow responses.', selector: '[data-guide-id="client-page-complaints"]', route: '/client/complaints', icon: AlertTriangle },
    { title: 'Profile', description: 'Update client profile and account details.', howItWorks: 'Keep this updated so the platform has the right information.', selector: '[data-guide-id="client-page-profile"]', route: '/client/profile', icon: User },
    { title: 'Settings', description: 'Account controls and guide restart live here.', howItWorks: 'Use settings for password/privacy and to open this guide again.', selector: '[data-guide-id="client-page-settings"]', route: '/client/settings', icon: Settings },
    { title: 'Guide Complete', description: 'You have seen all main client pages and tools.', howItWorks: 'Finish now. You can reopen from Settings anytime.', selector: '[data-guide-id="client-page-settings"]', route: '/client/settings', icon: CheckCircle2 },
];

const findTarget = (selector) => Array.from(document.querySelectorAll(selector)).find((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}) || null;

export default function ClientOnboardingModal() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isOpen, currentStep, setCurrentStep, skipGuide, finishGuide, closeGuide } = useClientOnboarding();
    const [targetRect, setTargetRect] = useState(null);
    const step = STEPS[currentStep];
    const totalSteps = STEPS.length;
    const isFirst = currentStep === 0;
    const isLast = currentStep === totalSteps - 1;
    const progress = ((currentStep + 1) / totalSteps) * 100;
    const Icon = step?.icon || Sparkles;

    useEffect(() => {
        if (!isOpen || !step) return;
        if (step.route && location.pathname !== step.route) {
            navigate(step.route);
            return;
        }
        const refresh = () => {
            const target = findTarget(step.selector);
            if (!target) { setTargetRect(null); return; }
            const rect = target.getBoundingClientRect();
            setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        };
        const timer = setTimeout(refresh, 140);
        window.addEventListener('resize', refresh);
        window.addEventListener('scroll', refresh, true);
        return () => { clearTimeout(timer); window.removeEventListener('resize', refresh); window.removeEventListener('scroll', refresh, true); };
    }, [isOpen, step, location.pathname, navigate]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event) => {
            if (event.key === 'Escape') closeGuide();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [closeGuide, isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {targetRect && (
                        <motion.div
                            className="fixed z-[9994] pointer-events-none rounded-xl border-2 border-orange-500"
                            initial={false}
                            animate={{ top: targetRect.top - 6, left: targetRect.left - 6, width: targetRect.width + 12, height: targetRect.height + 12 }}
                            transition={{ duration: 0.18 }}
                        />
                    )}
                    <motion.div
                        className="fixed z-[9996] right-3 bottom-3 sm:right-5 sm:bottom-5 w-[min(420px,calc(100vw-1.5rem))] bg-white rounded-2xl border border-orange-100 shadow-2xl"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-orange-50 via-white to-white rounded-t-2xl">
                            <button type="button" onClick={closeGuide} className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white" aria-label="Hide guide">
                                <X size={16} />
                            </button>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center"><Icon size={16} /></div>
                                <p className="text-xs font-bold tracking-widest uppercase text-gray-500">Step {currentStep + 1} of {totalSteps}</p>
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
                        </div>
                        <div className="p-4 sm:p-5 pt-3 flex items-center justify-between gap-2">
                            <button type="button" onClick={isFirst ? skipGuide : () => setCurrentStep((prev) => Math.max(prev - 1, 0))} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50">
                                {isFirst ? 'Skip' : <><ChevronLeft size={15} />Back</>}
                            </button>
                            <button type="button" onClick={() => (isLast ? finishGuide() : setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1)))} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-black">
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
