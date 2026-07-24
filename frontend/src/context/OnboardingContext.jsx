// frontend/src/context/OnboardingContext.jsx
// Manages the onboarding flow state. Works alongside AuthContext without duplicating
// any auth logic. Reads onboarding status from the user object (returned by /api/auth/me).

import React, {
    createContext, useContext, useState, useCallback, useEffect, useRef
} from 'react';
import { useAuth } from './AuthContext';
import api from '../api/axios';

const OnboardingContext = createContext(null);

// Steps in order:
// 0 = not started / loading
// 1 = policy popup
// 2 = app tour
// 3 = profile completion prompt
// 4 = fully complete (don't show anything)
const STEP = {
    LOADING:  0,
    POLICY:   1,
    TOUR:     2,
    PROFILE:  3,
    DONE:     4,
};

export const OnboardingProvider = ({ children }) => {
    const { user, authStatus, updateUserContext } = useAuth();
    const [step, setStep] = useState(STEP.LOADING);
    const [mandatoryPolicy, setMandatoryPolicy] = useState(null);
    const [statusLoaded, setStatusLoaded] = useState(false);
    const [policyAcceptancePending, setPolicyAcceptancePending] = useState(false);
    const [tourPending, setTourPending] = useState(false);
    const firstLoginApiCalled = useRef(false);

    // Determine which step the user is at based on their onboarding object.
    // This is purely derived — never stores its own copy of user data.
    const computeStep = useCallback((onboarding, policy) => {
        if (!onboarding) return STEP.DONE; // Existing employees with no onboarding object — skip

        // Existing employees have the onboarding sub-document with all defaults
        // (completed: false, firstLoginCompleted: false, etc.) because Mongoose
        // materialises embedded schema defaults for every document, even those
        // created before the onboarding feature existed.
        //
        // The ONLY reliable signal that this user has actually been enrolled in the
        // onboarding flow is profileCompletionDeadline — it stays null until
        // recordFirstLogin() runs (or an admin forces the flow).
        // If it's null AND firstLoginCompleted is still false, this is a pre-existing
        // employee who should never see the onboarding UI.
        if (!onboarding.profileCompletionDeadline && !onboarding.firstLoginCompleted) {
            return STEP.DONE; // Pre-existing employee — skip onboarding entirely
        }

        if (onboarding.completed) return STEP.DONE;

        // If there is no mandatory policy, skip the policy step
        const hasMandatoryPolicy = !!policy;

        if (!onboarding.policyAccepted && hasMandatoryPolicy) return STEP.POLICY;
        if (!onboarding.tourCompleted) return STEP.TOUR;
        if (!onboarding.profileCompleted) return STEP.PROFILE;
        return STEP.DONE;
    }, []);

    // Load onboarding status from backend (includes mandatory policy reference)
    const loadStatus = useCallback(async () => {
        if (!user || authStatus !== 'authenticated') return;

        // Skip onboarding for Admin and HR
        if (user.role === 'Admin' || user.role === 'HR') {
            setStep(STEP.DONE);
            setStatusLoaded(true);
            return;
        }

        try {
            const { data } = await api.get('/onboarding/status');
            setMandatoryPolicy(data.mandatoryPolicy || null);
            
            // If the backend says this user was never enrolled in onboarding
            // (pre-existing employee), skip the flow entirely.
            if (!data.isNewOnboardingEmployee) {
                setStep(STEP.DONE);
                return;
            }

            const ob = data.onboarding || user.onboarding || {};
            const computed = computeStep(ob, data.mandatoryPolicy);
            setStep(computed);
        } catch (e) {
            console.error('[Onboarding] Failed to load status:', e.message);
            // On error, don't block the user — let them proceed normally
            setStep(STEP.DONE);
        } finally {
            setStatusLoaded(true);
        }
    }, [user, authStatus, computeStep]);

    // When auth becomes authenticated, load status once
    useEffect(() => {
        if (authStatus === 'authenticated' && user && !statusLoaded) {
            loadStatus();
        }
        if (authStatus === 'unauthenticated') {
            setStep(STEP.LOADING);
            setStatusLoaded(false);
            firstLoginApiCalled.current = false;
        }
    }, [authStatus, user, statusLoaded, loadStatus]);

    // Record first login (idempotent — backend handles duplicates)
    const recordFirstLogin = useCallback(async () => {
        if (firstLoginApiCalled.current) return;
        firstLoginApiCalled.current = true;
        try {
            const { data } = await api.post('/onboarding/first-login');
            updateUserContext({ onboarding: data.onboarding });
        } catch (e) {
            console.error('[Onboarding] recordFirstLogin failed:', e.message);
        }
    }, [updateUserContext]);

    // Called when employee starts reading the policy
    const recordReadingStart = useCallback(async () => {
        try {
            await api.post('/onboarding/policy/start-reading');
        } catch (e) {
            console.error('[Onboarding] recordReadingStart failed:', e.message);
        }
    }, []);

    // Called when employee accepts policy
    const acceptPolicy = useCallback(async (payload) => {
        setPolicyAcceptancePending(true);
        try {
            const { data } = await api.post('/onboarding/policy/accept', payload);
            updateUserContext({ onboarding: data.onboarding });
            setStep(STEP.TOUR);
            return { success: true };
        } catch (e) {
            const msg = e.response?.data?.error || 'Failed to accept policy.';
            return { success: false, error: msg };
        } finally {
            setPolicyAcceptancePending(false);
        }
    }, [updateUserContext]);

    // Called when employee finishes the tour
    const completeTour = useCallback(async () => {
        setTourPending(true);
        try {
            const { data } = await api.post('/onboarding/tour/complete');
            updateUserContext({ onboarding: data.onboarding });
            setStep(STEP.PROFILE);
        } catch (e) {
            console.error('[Onboarding] completeTour failed:', e.message);
        } finally {
            setTourPending(false);
        }
    }, [updateUserContext]);

    // Called only after all required profile fields are saved
    const completeProfile = useCallback(async () => {
        try {
            const { data } = await api.post('/onboarding/profile/complete');
            updateUserContext({ onboarding: data.onboarding });
            setStep(STEP.DONE);
            return { success: true };
        } catch (e) {
            const msg = e.response?.data?.error || 'Failed to complete onboarding.';
            console.error('[Onboarding] completeProfile failed:', msg);
            return { success: false, error: msg };
        }
    }, [updateUserContext]);

    // Dismiss profile reminder (doesn't complete it — just hides the banner temporarily)
    const dismissProfileBanner = useCallback(() => {
        setStep(STEP.DONE);
    }, []);

    const value = {
        STEP,
        step,
        mandatoryPolicy,
        statusLoaded,
        policyAcceptancePending,
        tourPending,
        isOnboardingActive: step > STEP.LOADING && step < STEP.DONE,
        showPolicyModal: step === STEP.POLICY,
        showTour: step === STEP.TOUR,
        showProfilePrompt: step === STEP.PROFILE,
        recordFirstLogin,
        recordReadingStart,
        acceptPolicy,
        completeTour,
        completeProfile,
        dismissProfileBanner,
        reloadStatus: loadStatus,
    };

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
};

export const useOnboarding = () => {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
    return ctx;
};

export default OnboardingContext;
