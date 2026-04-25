import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Home, LayoutDashboard, Languages, BarChart3, QrCode, Package, History, UserCheck, Settings, CheckCircle2 } from 'lucide-react';
import { useShopOnboarding } from '../context/ShopOnboardingContext';

const SHOP_ONBOARDING_PAGE_EVENT = 'kc:shop-onboarding-page-change';

const STEPS = [
    { title: 'Navbar Home', description: 'This is the home entry in the top navbar.', howItWorks: 'Use it to go back to the landing area when needed.', selector: '[data-guide-id="shop-navbar-home"]', route: '/shop/dashboard', dashboardPage: 'analytics', icon: Home },
    { title: 'Navbar Dashboard', description: 'Quick access to the shop dashboard from the top navbar.', howItWorks: 'Use it to return to your shop overview immediately.', selector: '[data-guide-id="shop-navbar-dashboard"]', route: '/shop/dashboard', dashboardPage: 'analytics', icon: LayoutDashboard },
    { title: 'Navbar Language', description: 'Change language without leaving the shop area.', howItWorks: 'The guide stays available when language changes.', selector: '[data-guide-id="shop-navbar-language"]', route: '/shop/dashboard', dashboardPage: 'analytics', icon: Languages },
    { title: 'Analytics', description: 'Track sales, coupons, and live business performance.', howItWorks: 'This is your main dashboard view for daily monitoring.', selector: '[data-guide-id="shop-sidebar-analytics"]', route: '/shop/dashboard', dashboardPage: 'analytics', icon: BarChart3 },
    { title: 'Coupon Verification', description: 'Validate worker coupons and apply discounts.', howItWorks: 'Use this to confirm coupon validity before completing a sale.', selector: '[data-guide-id="shop-sidebar-coupon"]', route: '/shop/dashboard', dashboardPage: 'coupon', icon: QrCode },
    { title: 'Products', description: 'Manage shop products and inventory.', howItWorks: 'Open this when you need to add, edit, or search products.', selector: '[data-guide-id="shop-sidebar-products"]', route: '/shop/dashboard', dashboardPage: 'products', icon: Package },
    { title: 'History', description: 'Review past coupon redemptions and transactions.', howItWorks: 'Use history to audit sales and see product usage.', selector: '[data-guide-id="shop-sidebar-history"]', route: '/shop/dashboard', dashboardPage: 'history', icon: History },
    { title: 'Profile', description: 'Update shop identity, contact, and location details.', howItWorks: 'Keep profile updated so customers and workers see the right info.', selector: '[data-guide-id="shop-sidebar-profile"]', route: '/shop/dashboard', dashboardPage: 'profile', icon: UserCheck },
    { title: 'Settings', description: 'Account controls and guide restart live here.', howItWorks: 'Use settings for security and to reopen this guide anytime.', selector: '[data-guide-id="shop-sidebar-settings"]', route: '/shop/dashboard', dashboardPage: 'settings', icon: Settings },
    { title: 'Guide Complete', description: 'You have seen all main shop pages and controls.', howItWorks: 'Finish now. You can restart from settings whenever you want.', selector: '[data-guide-id="shop-sidebar-settings"]', route: '/shop/dashboard', dashboardPage: 'settings', icon: CheckCircle2 },
];

const findTarget = (selector) => Array.from(document.querySelectorAll(selector)).find((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}) || null;

export default function ShopOnboardingModal() {
    const { isOpen, currentStep, setCurrentStep, skipGuide, finishGuide, closeGuide } = useShopOnboarding();
    const [targetRect, setTargetRect] = useState(null);
    const step = STEPS[currentStep];
    const totalSteps = STEPS.length;
    const isFirst = currentStep === 0;
    const isLast = currentStep === totalSteps - 1;
    const progress = ((currentStep + 1) / totalSteps) * 100;
    const Icon = step?.icon || BarChart3;

    useEffect(() => {
        if (!isOpen || !step) return;
        if (step.route && window.location.pathname !== step.route) {
            window.history.replaceState({}, '', step.route);
            window.dispatchEvent(new PopStateEvent('popstate'));
            return;
        }

        if (step.dashboardPage) {
            window.dispatchEvent(new CustomEvent(SHOP_ONBOARDING_PAGE_EVENT, {
                detail: { page: step.dashboardPage },
            }));
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
    }, [isOpen, step]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event) => { if (event.key === 'Escape') closeGuide(); };
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
