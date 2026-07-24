// frontend/src/components/onboarding/OnboardingOrchestrator.jsx
// Sits at the top of the protected layout and manages the onboarding flow.
//
// Flow:
//   1. Detects first login and calls recordFirstLogin() for eligible roles
//   2. Renders the policy modal (blocks entire UI) — Step 1
//   3. Renders the app tour (after policy) — Step 2
//   4. Profile banner is handled separately in ProfilePage
//
// IMPORTANT: Admin and HR users skip onboarding entirely.
// The correct dashboard is already rendered by DashboardRouter in App.jsx
// before this component runs — this component never forces a dashboard render.

import React, { useEffect, useRef } from 'react';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';
import OnboardingPolicyModal from './OnboardingPolicyModal';
import AppTour from './AppTour';

const OnboardingOrchestrator = () => {
    const { user, authStatus } = useAuth();
    const {
        step,
        STEP,
        statusLoaded,
        showPolicyModal,
        showTour,
        recordFirstLogin,
    } = useOnboarding();
    const firstLoginTriggered = useRef(false);

    // Trigger first-login recording once auth is confirmed for eligible roles.
    // We only call recordFirstLogin if the onboarding context has determined
    // this user should actually go through onboarding (step > LOADING and < DONE).
    // This prevents pre-existing employees (whose onboarding sub-document has
    // default false values from the Mongoose schema) from being enrolled.
    useEffect(() => {
        if (
            authStatus !== 'authenticated' ||
            !user ||
            !statusLoaded ||
            firstLoginTriggered.current
        ) return;

        // Admin and HR skip onboarding entirely
        if (user.role === 'Admin' || user.role === 'HR') return;

        // Only trigger for users the onboarding context has flagged as active
        // (step is somewhere in the flow, not already DONE/LOADING)
        const ob = user.onboarding || {};
        const isEnrolled = !!(
            ob.profileCompletionDeadline ||
            ob.firstLoginCompleted ||
            ob.forcedOnboardingBy
        );

        if (!isEnrolled) {
            // Pre-existing employee — mark as handled and skip
            firstLoginTriggered.current = true;
            return;
        }

        if (!ob.firstLoginCompleted) {
            firstLoginTriggered.current = true;
            recordFirstLogin();
        } else {
            firstLoginTriggered.current = true;
        }
    }, [authStatus, user, statusLoaded, recordFirstLogin]);

    // Wait until auth and onboarding status are both resolved
    if (!statusLoaded || authStatus !== 'authenticated') return null;

    // Admin and HR: skip all onboarding UI completely
    if (user?.role === 'Admin' || user?.role === 'HR') return null;

    return (
        <>
            {/* Step 1 — Policy modal: full-screen, blocks all interaction */}
            {showPolicyModal && <OnboardingPolicyModal />}

            {/* Step 2 — Guided tour: starts with welcome screen, then driver.js */}
            {showTour && <AppTour />}
        </>
    );
};

export default OnboardingOrchestrator;
