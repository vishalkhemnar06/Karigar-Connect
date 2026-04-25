import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const GUIDE_OPEN_KEY = 'kc_worker_guide_open_v1';
const GUIDE_STEP_KEY = 'kc_worker_guide_step_v1';

const parseUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
        return {};
    }
};

const getWorkerIdentity = () => {
    const user = parseUser();
    return user?._id || user?.id || user?.karigarId || user?.mobile || 'worker';
};

const doneKeyForWorker = () => `kc_worker_onboarding_done_v1_${getWorkerIdentity()}`;

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

const WorkerOnboardingContext = createContext(null);

export function WorkerOnboardingProvider({ children }) {
    const location = useLocation();
    const hasCheckedAutoShowRef = useRef(false);

    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const isGuideDone = useCallback(() => {
        return getCookie(doneKeyForWorker()) === '1';
    }, []);

    const markGuideDone = useCallback(() => {
        setCookie(doneKeyForWorker(), '1');
    }, []);

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

    const restartGuideFromSettings = useCallback(() => {
        openGuide(0);
    }, [openGuide]);

    useEffect(() => {
        const isWorkerRoute = location.pathname.startsWith('/worker');
        if (!isWorkerRoute) return;

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
    }), [
        closeGuide,
        currentStep,
        finishGuide,
        isOpen,
        openGuide,
        restartGuideFromSettings,
        skipGuide,
    ]);

    return (
        <WorkerOnboardingContext.Provider value={value}>
            {children}
        </WorkerOnboardingContext.Provider>
    );
}

export function useWorkerOnboarding() {
    const context = useContext(WorkerOnboardingContext);
    if (!context) {
        throw new Error('useWorkerOnboarding must be used inside WorkerOnboardingProvider');
    }
    return context;
}
