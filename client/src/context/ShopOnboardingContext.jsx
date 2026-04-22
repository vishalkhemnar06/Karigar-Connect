import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const GUIDE_OPEN_KEY = 'kc_shop_guide_open_v1';
const GUIDE_STEP_KEY = 'kc_shop_guide_step_v1';

const parseShop = () => {
    try {
        return JSON.parse(localStorage.getItem('shop') || '{}');
    } catch {
        return {};
    }
};

const getShopIdentity = () => {
    const shop = parseShop();
    return shop?._id || shop?.id || shop?.shopId || shop?.mobile || shop?.ownerMobile || 'shop';
};

const doneKeyForShop = () => `kc_shop_onboarding_done_v1_${getShopIdentity()}`;

const getCookie = (name) => {
    const row = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    return row ? decodeURIComponent(row.slice(name.length + 1)) : null;
};

const setCookie = (name, value, days = 3650) => {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
};

const ShopOnboardingContext = createContext(null);

export function ShopOnboardingProvider({ children }) {
    const location = useLocation();
    const hasCheckedAutoShowRef = useRef(false);
    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const isGuideDone = useCallback(() => getCookie(doneKeyForShop()) === '1', []);
    const markGuideDone = useCallback(() => { setCookie(doneKeyForShop(), '1'); }, []);
    const clearGuideSessionState = useCallback(() => {
        sessionStorage.removeItem(GUIDE_OPEN_KEY);
        sessionStorage.removeItem(GUIDE_STEP_KEY);
    }, []);

    const openGuide = useCallback((startStep = 0) => {
        setCurrentStep(startStep);
        setIsOpen(true);
    }, []);

    const closeGuide = useCallback(() => {
        markGuideDone();
        setIsOpen(false);
        clearGuideSessionState();
    }, [clearGuideSessionState, markGuideDone]);

    const skipGuide = useCallback(() => {
        markGuideDone();
        setIsOpen(false);
        clearGuideSessionState();
    }, [clearGuideSessionState, markGuideDone]);

    const finishGuide = useCallback(() => {
        markGuideDone();
        setIsOpen(false);
        clearGuideSessionState();
    }, [clearGuideSessionState, markGuideDone]);

    const restartGuideFromSettings = useCallback(() => openGuide(0), [openGuide]);

    useEffect(() => {
        const isShopRoute = location.pathname.startsWith('/shop');
        if (!isShopRoute) return;
        if (hasCheckedAutoShowRef.current) return;
        hasCheckedAutoShowRef.current = true;

        const restoreOpen = sessionStorage.getItem(GUIDE_OPEN_KEY) === '1';
        if (restoreOpen) {
            const restoredStep = Number(sessionStorage.getItem(GUIDE_STEP_KEY) || '0');
            openGuide(Number.isFinite(restoredStep) ? Math.max(restoredStep, 0) : 0);
            return;
        }

        if (!isGuideDone()) {
            openGuide(0);
        }
    }, [isGuideDone, location.pathname, openGuide]);

    useEffect(() => {
        if (!isOpen) return;
        sessionStorage.setItem(GUIDE_OPEN_KEY, '1');
        sessionStorage.setItem(GUIDE_STEP_KEY, String(currentStep));
    }, [currentStep, isOpen]);

    const value = useMemo(() => ({
        isOpen,
        currentStep,
        setCurrentStep,
        closeGuide,
        skipGuide,
        finishGuide,
        openGuide,
        restartGuideFromSettings,
    }), [closeGuide, currentStep, finishGuide, isOpen, openGuide, restartGuideFromSettings, skipGuide]);

    return <ShopOnboardingContext.Provider value={value}>{children}</ShopOnboardingContext.Provider>;
}

export function useShopOnboarding() {
    const context = useContext(ShopOnboardingContext);
    if (!context) throw new Error('useShopOnboarding must be used inside ShopOnboardingProvider');
    return context;
}
