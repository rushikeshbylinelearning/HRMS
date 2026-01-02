// frontend/src/pages/EmployeeDashboardPage.jsx
import React, { useState, useEffect, useCallback, useMemo, memo, useRef, forwardRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Typography, Button, CircularProgress, Alert, Stack, Box, Grid, Paper, 
    Avatar, Divider, Chip, IconButton, Dialog, DialogTitle, DialogContent, 
    DialogActions, Slide, Fade, TextField, Snackbar, Tooltip, Skeleton
} from '@mui/material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { getLocationWithTimeout } from '../utils/locationUtils';
import { getAvatarUrl } from '../utils/avatarUtils';
import socket from '../socket';
import WorkTimeTracker from '../components/WorkTimeTracker';
import BreakTimer from '../components/BreakTimer';
import ShiftInfoDisplay from '../components/ShiftInfoDisplay';
import WeeklyTimeCards from '../components/WeeklyTimeCards';
import LiveClock from '../components/LiveClock';
import SaturdaySchedule from '../components/SaturdaySchedule';
import RecentActivityCard from '../components/RecentActivityCard';
import ShiftProgressBar from '../components/ShiftProgressBar';
import { ShiftInfoSkeleton, RecentActivitySkeleton, SaturdayScheduleSkeleton, WeeklyTimeCardsSkeleton } from '../components/DashboardSkeletons';
import '../styles/EmployeeDashboardPage.css';

// Icons
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LogoutIcon from '@mui/icons-material/Logout';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import NoMealsIcon from '@mui/icons-material/NoMeals';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';

const MemoizedWeeklyTimeCards = memo(WeeklyTimeCards);
const MemoizedLiveClock = memo(LiveClock);
const MemoizedSaturdaySchedule = memo(SaturdaySchedule);
const MemoizedShiftInfoDisplay = memo(ShiftInfoDisplay);
const MemoizedRecentActivityCard = memo(RecentActivityCard);
const MemoizedWorkTimeTracker = memo(WorkTimeTracker);
const MemoizedBreakTimer = memo(BreakTimer);
const MemoizedShiftProgressBar = memo(ShiftProgressBar);
const DialogTransition = forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});
const BreakModalTransition = forwardRef(function Transition(props, ref) {
    return <Fade ref={ref} {...props} timeout={400} />;
});

// Framer Motion variants for break modal items
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.07 }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
        y: 0, 
        opacity: 1, 
        transition: { 
            type: "spring", 
            stiffness: 100,
            damping: 15
        } 
    }
};
const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


const EmployeeDashboardPage = () => {
    const { user: contextUser, updateUserContext } = useAuth();
    const { canAccess, breakLimits, privilegeLevel } = usePermissions();
    const location = useLocation();
    const [dailyData, setDailyData] = useState(null);
    const [weeklyLogs, setWeeklyLogs] = useState([]);
    const [myRequests, setMyRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
    
    const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
    const [breakReason, setBreakReason] = useState('');
    const [isSubmittingReason, setIsSubmittingReason] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });
    const [weeklyLateDialog, setWeeklyLateDialog] = useState({ open: false, lateCount: 0, lateDates: [] });
    const [avatarImageError, setAvatarImageError] = useState(false);
    const breakActionInFlightRef = useRef(false);
    const clockInActionInFlightRef = useRef(false);
    const clockOutActionInFlightRef = useRef(false);


    const isClockedInSession = dailyData?.status === 'Clocked In' || dailyData?.status === 'On Break';

    const fetchAllDataRef = useRef(null);
    // AbortController ref to track and cancel in-flight requests
    // This prevents race conditions when multiple refresh triggers occur simultaneously
    // (e.g., polling + socket update + manual refresh happening at the same time)
    const abortControllerRef = useRef(null);
    
    // Create stable fetch function with request deduplication
    // DEDUPLICATION RATIONALE:
    // - Multiple triggers can fire simultaneously: polling interval, socket events, manual refresh
    // - Without deduplication, multiple API calls race each other, causing:
    //   1. Unnecessary server load
    //   2. Stale data overwriting fresh data (last response wins, not most recent)
    //   3. UI flickering from multiple state updates
    //   4. Potential memory leaks from unresolved promises
    // - AbortController ensures only ONE request is active at a time
    fetchAllDataRef.current = async (isInitialLoad = false) => {
        // Cancel any previous in-flight request before starting a new one
        // This ensures we only have ONE active request at any time
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        
        // Create new AbortController for this request
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const signal = abortController.signal;
        
        const localDate = getLocalDateString();
        
        // Helper to check if error is from abort (should be handled silently)
        const isAbortError = (err) => {
            return err.name === 'AbortError' || 
                   err.code === 'ECONNABORTED' || 
                   signal.aborted;
        };
        
        if (isInitialLoad) {
            // For initial load, fetch critical data (status) first for instant UI
            // Then load other data in background
            setLoading(true);
            try {
                // Load status immediately - this is critical for UI
                const statusRes = await api.get(`/attendance/status?date=${localDate}`, { signal });
                
                // Check if request was aborted before updating state
                if (signal.aborted) return;
                
                setDailyData(statusRes.data);
                setLoading(false); // Allow UI to render immediately after status loads
                
                // Load weekly logs and requests in background (non-blocking)
                Promise.all([
                    api.get('/attendance/my-weekly-log', { signal }),
                    api.get('/leaves/my-requests', { signal }),
                ]).then(([weeklyRes, requestsRes]) => {
                    // Check if request was aborted before updating state
                    if (signal.aborted) return;
                    
                    setWeeklyLogs(Array.isArray(weeklyRes.data) ? weeklyRes.data : []);
                    setMyRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
                }).catch(err => {
                    // Silently handle aborted requests - they're expected when new request starts
                    if (isAbortError(err)) {
                        return; // Don't log or show errors for aborted requests
                    }
                    console.error("Background data fetch error:", err);
                    // Don't show error for background data - it's not critical
                });
            } catch (err) {
                // Silently handle aborted requests - they're expected when new request starts
                if (isAbortError(err)) {
                    return; // Don't log or show errors for aborted requests
                }
                console.error("Dashboard status fetch error:", err);
                setError('Failed to load dashboard data. Please refresh the page.');
                setLoading(false);
            } finally {
                // Clear abort controller if this was the active request
                if (abortControllerRef.current === abortController) {
                    abortControllerRef.current = null;
                }
            }
        } else {
            // For subsequent refreshes, fetch all data in parallel (non-blocking)
            try {
                const [statusRes, weeklyRes, requestsRes] = await Promise.all([
                    api.get(`/attendance/status?date=${localDate}`, { signal }),
                    api.get('/attendance/my-weekly-log', { signal }),
                    api.get('/leaves/my-requests', { signal }),
                ]);
                
                // Check if request was aborted before updating state
                if (signal.aborted) return;
                
                setDailyData(statusRes.data);
                setWeeklyLogs(Array.isArray(weeklyRes.data) ? weeklyRes.data : []);
                setMyRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
            } catch (err) {
                // Silently handle aborted requests - they're expected when new request starts
                if (isAbortError(err)) {
                    return; // Don't log or show errors for aborted requests
                }
                console.error("Dashboard fetch error:", err);
                // Don't show error for background refresh - silent fail
            } finally {
                // Clear abort controller if this was the active request
                if (abortControllerRef.current === abortController) {
                    abortControllerRef.current = null;
                }
            }
        }
    };
    
    const fetchAllData = useCallback((isInitialLoad = false) => {
        return fetchAllDataRef.current?.(isInitialLoad);
    }, []);

    // Guard ref for React StrictMode duplicate execution prevention
    const dataFetchedRef = useRef(false);
    const { loading: authLoading } = useAuth();
    
    useEffect(() => { 
        // CRITICAL FIX: Guard API calls - only execute if auth is ready and user is authenticated
        // This prevents API calls during page refresh before auth state is restored
        if (authLoading || !contextUser) {
            console.log('[EmployeeDashboard] Waiting for auth to initialize...');
            // Stop polling if user logs out
            return;
        }
        
        let mounted = true;
        let intervalId = null;
        let isTabVisible = !document.hidden;
        
        // ADAPTIVE POLLING: Dynamic interval based on status and tab visibility
        // - Clocked In/On Break + Tab Visible: 10s (frequent updates for active users)
        // - Clocked Out + Tab Visible: 60s (less frequent, user not actively working)
        // - Tab Hidden: 60s (reduce background activity)
        // - User Logged Out: No polling (handled by early return above)
        const getPollingInterval = () => {
            // If tab is hidden, use slower polling regardless of status
            if (!isTabVisible) {
                return 60000; // 60 seconds when tab hidden
            }
            
            // When tab is visible, adapt based on status
            const isActive = dailyData?.status === 'Clocked In' || dailyData?.status === 'On Break';
            return isActive ? 10000 : 60000; // 10s when active, 60s when clocked out
        };
        
        const startPolling = () => {
            // Clear any existing interval
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            
            // Don't poll if component unmounted or user logged out
            if (!mounted || !contextUser) {
                return;
            }
            
            const interval = getPollingInterval();
            intervalId = setInterval(() => {
                if (mounted && contextUser && fetchAllDataRef.current) {
                    fetchAllDataRef.current(false);
                }
            }, interval);
        };
        
        // Handle visibility changes to adjust polling
        const handleVisibilityChange = () => {
            isTabVisible = !document.hidden;
            // Restart polling with new interval when visibility changes
            startPolling();
        };
        
        const loadData = async () => {
            // Prevent duplicate execution in React StrictMode
            if (dataFetchedRef.current) {
                console.log('[EmployeeDashboard] Data fetch already in progress, skipping duplicate call');
                return;
            }
            dataFetchedRef.current = true;
            
            if (fetchAllDataRef.current) {
                await fetchAllDataRef.current(true);
            }
            
            if (mounted && contextUser) {
                // Start polling after initial load completes
                // Delay to ensure dailyData is set from initial fetch
                setTimeout(() => {
                    if (mounted && contextUser) {
                        startPolling();
                    }
                }, 1000);
            }
        };
        
        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        loadData();
        
        return () => {
            mounted = false;
            dataFetchedRef.current = false; // Reset on unmount
            
            // Remove visibility listener
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            
            // Abort any pending requests on unmount to prevent state updates after component unmounts
            // This prevents memory leaks and "Can't perform a React state update on an unmounted component" warnings
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            
            // Stop polling on unmount or logout
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };
     }, [contextUser, authLoading, dailyData?.status]); // Include dailyData?.status to restart polling when status changes

    useEffect(() => {
        if (location.state?.refresh) {
            console.log("Dashboard received refresh signal, refetching data...");
            if (fetchAllDataRef.current) {
                fetchAllDataRef.current(false);
            }
            window.history.replaceState({}, document.title);
        }
    }, [location.state]); // Remove fetchAllData from deps to prevent re-runs

    // Socket.IO listener for real-time attendance updates
    useEffect(() => {
        if (!contextUser) return;

        // Listen for attendance log updates
        const handleAttendanceLogUpdate = (data) => {
            console.log('📡 EmployeeDashboardPage received attendance_log_updated event:', data);
            
            // Check if the update affects the current user
            const isRelevantUpdate = (
                data.userId === contextUser.id || // Update affects current user
                data.userId === contextUser._id || // Alternative ID format
                data.userId?.toString() === contextUser.id?.toString() ||
                data.userId?.toString() === contextUser._id?.toString()
            );

            if (isRelevantUpdate) {
                console.log('🔄 Refreshing EmployeeDashboardPage data due to attendance log update');
                // Refetch all data to get updated attendance status (non-blocking)
                if (fetchAllDataRef.current) {
                    fetchAllDataRef.current(false).catch(err => {
                        console.error('Failed to refresh after socket update:', err);
                    });
                }
            }
        };

        // Set up event listener
        socket.on('attendance_log_updated', handleAttendanceLogUpdate);

        // Cleanup on unmount
        return () => {
            socket.off('attendance_log_updated', handleAttendanceLogUpdate);
        };
    }, [contextUser?.id, contextUser?._id]); // Only depend on user IDs, not fetchAllData

    // Reset avatar error state when profile image URL changes
    useEffect(() => {
        setAvatarImageError(false);
    }, [contextUser?.profileImageUrl]);

    const workedMinutes = useMemo(() => {
        if (!dailyData?.sessions?.[0]?.startTime) return 0;
        const now = new Date();
        const grossTimeMs = dailyData.sessions.reduce((total, s) => total + ((s.endTime ? new Date(s.endTime) : now) - new Date(s.startTime)), 0);
        const breakTimeMs = (dailyData.breaks || []).reduce((total, b) => total + ((b.endTime ? new Date(b.endTime) : now) - new Date(b.startTime)), 0);
        return Math.floor(Math.max(0, grossTimeMs - breakTimeMs) / 60000);
    }, [dailyData]);
    
    const serverCalculated = useMemo(() => ({
        penaltyMinutes: dailyData?.attendanceLog?.penaltyMinutes || 0,
        paidMinutesTaken: dailyData?.attendanceLog?.paidBreakMinutesTaken || 0,
        unpaidBreakMinutesTaken: dailyData?.attendanceLog?.unpaidBreakMinutesTaken || 0,
    }), [dailyData?.attendanceLog]);
    
    const paidBreakAllowance = dailyData?.shift?.paidBreakMinutes || 30;
    const hasExhaustedPaidBreak = (serverCalculated.paidMinutesTaken || 0) >= paidBreakAllowance;
    const hasTakenUnpaidBreak = useMemo(() => dailyData?.breaks?.some(b => b.breakType === 'Unpaid'), [dailyData?.breaks]);
    const hasTakenExtraBreak = useMemo(() => dailyData?.breaks?.some(b => b.breakType === 'Extra'), [dailyData?.breaks]);
    const hasPendingExtraBreak = !!dailyData?.pendingExtraBreakRequest;
    const hasApprovedExtraBreak = !!dailyData?.approvedExtraBreak;
    
    const paidBreakCheck = useMemo(() => breakLimits.canTakeBreakNow('Paid'), [breakLimits]);
    const unpaidBreakCheck = useMemo(() => breakLimits.canTakeBreakNow('Unpaid'), [breakLimits]);
    const extraBreakCheck = useMemo(() => breakLimits.canTakeBreakNow('Extra'), [breakLimits]);

    const isAnyBreakPossible = useMemo(() => {
        if (!canAccess.breaks() || !canAccess.takeBreak()) return false;
        
        const paidAllowed = !hasExhaustedPaidBreak && paidBreakCheck.allowed;
        const unpaidAllowed = !hasTakenUnpaidBreak && unpaidBreakCheck.allowed;
        const extraAllowed = hasApprovedExtraBreak && !hasTakenExtraBreak && extraBreakCheck.allowed;
        const requestExtraAllowed = !hasPendingExtraBreak && !hasTakenExtraBreak && extraBreakCheck.allowed;

        return paidAllowed || unpaidAllowed || extraAllowed || requestExtraAllowed;
    }, [
        canAccess, hasExhaustedPaidBreak, paidBreakCheck, hasTakenUnpaidBreak, 
        unpaidBreakCheck, hasApprovedExtraBreak, hasTakenExtraBreak, 
        hasPendingExtraBreak, extraBreakCheck
    ]);
    
    const handleActionWithOptimisticUpdate = async (apiCall, optimisticUpdate) => {
        setActionLoading(true); setError('');
        const previousDailyData = dailyData;
        optimisticUpdate();
        try { await apiCall(); await fetchAllData(); } 
        catch (err) { setDailyData(previousDailyData); setError(err.response?.data?.error || 'An unexpected error occurred.'); } 
        finally { setActionLoading(false); }
    };

    const handleClockIn = async () => {
        if (clockInActionInFlightRef.current) return;
        
        // Show immediate loading state for instant feedback
        clockInActionInFlightRef.current = true;
        setActionLoading(true);
        setError('');
        
        // Show "Fetching location..." feedback immediately
        setSnackbar({ open: true, message: 'Fetching location…', severity: 'info' });
        
        const previousDailyData = dailyData;
        
        try {
            // Attempt to get location with 3-second timeout (tries cached first, then fresh)
            // This will never block longer than 3 seconds
            const location = await getLocationWithTimeout(3000);
            
            // If location unavailable, show non-blocking warning but allow check-in to proceed
            if (!location) {
                setSnackbar({ 
                    open: true, 
                    message: 'Location unavailable. Check-in will proceed without location verification.', 
                    severity: 'warning' 
                });
            }
            
            // Immediate optimistic UI update for instant feedback
            setDailyData(prev => ({ ...prev, status: 'Clocked In', sessions: [{ startTime: new Date().toISOString(), endTime: null }] }));

            try {
                // Send location (may be null) - backend will handle validation
                const res = await api.post('/attendance/clock-in', location || {});

                // If backend signals weekly late warning (3+), show a popup but DO NOT lock account
                const warning = res?.data?.weeklyLateWarning;
                if (warning && warning.showPopup) {
                    setWeeklyLateDialog({ open: true, lateCount: warning.lateCount || 0, lateDates: warning.lateDates || [] });
                }

                // Show success message
                setSnackbar({ open: true, message: 'Checked in successfully!', severity: 'success' });

                // Refresh data from server (non-blocking for UI)
                if (fetchAllDataRef.current) {
                    fetchAllDataRef.current(false).catch(err => {
                        console.error('Failed to refresh data after clock-in:', err);
                    });
                }
            } catch (err) {
                // Revert optimistic update on error and show message
                setDailyData(previousDailyData);
                setError(err.response?.data?.error || 'Failed to clock in.');
                setSnackbar({ open: true, message: 'Check in failed. Please try again.', severity: 'error' });
            } finally {
                setActionLoading(false);
                clockInActionInFlightRef.current = false;
            }
        } catch (error) {
            // This should never happen as getLocationWithTimeout never throws, but handle gracefully
            console.error('Unexpected error in handleClockIn:', error);
            clockInActionInFlightRef.current = false;
            setActionLoading(false);
            setError('An unexpected error occurred. Please try again.');
            setSnackbar({ open: true, message: 'Check in failed. Please try again.', severity: 'error' });
        }
    };
    const handleClockOut = async () => {
        if (clockOutActionInFlightRef.current) return;
        
        clockOutActionInFlightRef.current = true;
        setActionLoading(true);
        setError('');
        const previousDailyData = dailyData;
        // Immediate optimistic update
        setDailyData(prev => ({ ...prev, status: 'Clocked Out' }));
        setSnackbar({ open: true, message: 'Checked out successfully!' });
        
        try {
            await api.post('/attendance/clock-out');
            // Refresh data from server (non-blocking for UI)
            if (fetchAllDataRef.current) {
                fetchAllDataRef.current(false).catch(err => {
                    console.error('Failed to refresh data after clock-out:', err);
                });
            }
        } catch (err) {
            // Revert on error
            setDailyData(previousDailyData);
            setError(err.response?.data?.error || 'Failed to clock out. Please try again.');
            setSnackbar({ open: true, message: 'Check out failed. Please try again.' });
        } finally {
            setActionLoading(false);
            clockOutActionInFlightRef.current = false;
        }
    };

    const handleStartBreak = async (breakType) => {
        if (breakActionInFlightRef.current) return;
        breakActionInFlightRef.current = true;
        setIsBreakModalOpen(false);
        setError('');
        
        // Save previous state for accurate reversion on error
        const previousDailyData = dailyData;
        
        // Optimistic lock: Freeze UI state immediately
        const clientStartTime = new Date().toISOString();
        const optimisticBreak = { 
            breakType, 
            startTime: clientStartTime, 
            endTime: null,
            _optimistic: true // Mark as optimistic - used to identify and remove on failure
        };
        
        // Immediate optimistic update - UI freezes in this state
        setDailyData(prev => ({ 
            ...prev, 
            status: 'On Break', 
            breaks: [...(prev.breaks || []), optimisticBreak],
            _breakActionInProgress: true // Lock flag
        }));
        setSnackbar({ open: true, message: `Starting break...`, severity: 'info' });
        
        try {
            const response = await api.post('/breaks/start', { breakType });
            const { break: serverBreak, serverStartTime, calculatedLogoutTime, alreadyActive } = response.data;
            
            // Merge-only reconciliation: Never revert, only update forward
            setDailyData(prev => {
                // Remove optimistic break and add server break
                const breaksWithoutOptimistic = (prev.breaks || []).filter(b => !b._optimistic);
                const updatedBreaks = [...breaksWithoutOptimistic];
                
                // If already active, use existing break; otherwise use new break
                if (alreadyActive && serverBreak) {
                    updatedBreaks.push(serverBreak);
                } else if (serverBreak) {
                    updatedBreaks.push(serverBreak);
                }
                
                return {
                    ...prev,
                    breaks: updatedBreaks,
                    status: 'On Break',
                    calculatedLogoutTime: calculatedLogoutTime || prev.calculatedLogoutTime,
                    _breakActionInProgress: false // Unlock
                };
            });
            
            setSnackbar({ open: true, message: `Break started successfully!`, severity: 'success' });
        } catch (err) {
            // On API failure: Remove optimistic break to ensure UI state matches server truth
            // The optimistic break was never created on the server, so it must be removed from UI
            setDailyData(prev => {
                // Remove optimistic break entries (identified by _optimistic flag)
                const breaksWithoutOptimistic = (prev.breaks || []).filter(b => !b._optimistic);
                
                // Determine correct status: revert to previous status if no active breaks remain
                // If there are other non-optimistic active breaks, keep 'On Break' status
                const hasActiveBreak = breaksWithoutOptimistic.some(b => !b.endTime);
                const previousStatus = previousDailyData?.status || 'Clocked In';
                const newStatus = hasActiveBreak ? 'On Break' : previousStatus;
                
                return {
                    ...prev,
                    breaks: breaksWithoutOptimistic,
                    status: newStatus,
                    _breakActionInProgress: false, // Unlock UI
                    _breakError: undefined // Clear any previous break errors
                };
            });
            
            // Show clear error message to user
            const errorMessage = err.response?.data?.error || 'Failed to start break. Please try again.';
            setError(errorMessage);
            setSnackbar({ open: true, message: errorMessage, severity: 'error' });
        } finally {
            breakActionInFlightRef.current = false;
        }
    };

    const handleEndBreak = async () => {
        if (breakActionInFlightRef.current) return;
        breakActionInFlightRef.current = true;
        setError('');
        
        // Find the active break
        const activeBreak = dailyData?.breaks?.find(b => !b.endTime);
        if (!activeBreak) {
            breakActionInFlightRef.current = false;
            return;
        }
        
        // Optimistic lock: Freeze UI state immediately
        const clientEndTime = new Date().toISOString();
        
        // Immediate optimistic update - UI freezes in this state
        setDailyData(prev => {
            const updatedBreaks = (prev.breaks || []).map(b => {
                const isActiveBreak = !b.endTime && (
                    (activeBreak?._id && b._id === activeBreak._id) ||
                    (!activeBreak?._id && b.startTime === activeBreak?.startTime)
                );
                if (isActiveBreak) {
                    return {
                        ...b,
                        endTime: clientEndTime,
                        _optimistic: true, // Mark as optimistic
                        durationMinutes: b.durationMinutes || Math.round((new Date(clientEndTime) - new Date(b.startTime)) / (1000 * 60))
                    };
                }
                return b;
            });
            return { 
                ...prev, 
                status: 'Clocked In', 
                breaks: updatedBreaks,
                _breakActionInProgress: true // Lock flag
            };
        });
        setSnackbar({ open: true, message: 'Ending break...', severity: 'info' });
        
        try {
            const response = await api.post('/breaks/end');
            const { 
                break: serverBreak, 
                finalDurationMinutes, 
                calculatedLogoutTime,
                updatedAttendanceSnapshot,
                alreadyEnded 
            } = response.data;
            
            // Merge-only reconciliation: Never revert, only update forward
            setDailyData(prev => {
                // Remove optimistic break and add server break
                const breaksWithoutOptimistic = (prev.breaks || []).map(b => {
                    if (b._optimistic && !b.endTime) {
                        // This was the optimistic break - replace with server data
                        return serverBreak || { ...b, endTime: clientEndTime, _optimistic: false };
                    }
                    return { ...b, _optimistic: false };
                });
                
                // If server returned updated break, use it
                const updatedBreaks = serverBreak 
                    ? breaksWithoutOptimistic.map(b => 
                        (b._id === serverBreak._id || (!b._id && b.startTime === activeBreak?.startTime)) 
                            ? serverBreak 
                            : b
                      )
                    : breaksWithoutOptimistic;
                
                return {
                    ...prev,
                    breaks: updatedBreaks,
                    status: 'Clocked In',
                    calculatedLogoutTime: calculatedLogoutTime || prev.calculatedLogoutTime,
                    _breakActionInProgress: false // Unlock
                };
            });
            
            setSnackbar({ open: true, message: 'Break ended successfully!', severity: 'success' });
        } catch (err) {
            // Merge-only: On error, keep UI state but mark as error
            setDailyData(prev => ({
                ...prev,
                _breakActionInProgress: false,
                _breakError: err.response?.data?.error || 'Failed to end break. Please try again.'
            }));
            setError(err.response?.data?.error || 'Failed to end break. Please try again.');
            setSnackbar({ open: true, message: 'Failed to end break. Please refresh.', severity: 'error' });
        } finally {
            breakActionInFlightRef.current = false;
        }
    };
    
    const handleRequestExtraBreak = async () => {
        if (!breakReason.trim()) { setError("Please provide a reason."); return; }
        setIsSubmittingReason(true); setError('');
        try {
            await api.post('/breaks/request-extra', { reason: breakReason });
            setSnackbar({ open: true, message: 'Request sent for approval.' });
            handleCloseReasonModal();
            if (fetchAllDataRef.current) {
                await fetchAllDataRef.current(false);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send request.');
        } finally {
            setIsSubmittingReason(false);
        }
    };

    const handleOpenBreakModal = () => setIsBreakModalOpen(true);
    const handleCloseBreakModal = () => setIsBreakModalOpen(false);
    const handleOpenReasonModal = () => { setIsBreakModalOpen(false); setIsReasonModalOpen(true); };
    const handleCloseReasonModal = () => { setIsReasonModalOpen(false); setBreakReason(''); setError(''); };

    // =================================================================
    // ### START OF FIX ###
    // Only block on user context - allow dashboard to render with loading state
    // Dashboard will show skeletons while data loads progressively
    if (!contextUser) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }
    // ### END OF FIX ###
    // =================================================================
    
    // Show skeleton/loading state if critical data not yet loaded, but don't block render
    if (loading || !dailyData) {
        // Render dashboard shell with skeletons - allows progressive loading
        return (
            <Box className="employee-dashboard-container">
                <Grid container spacing={3}>
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={3}>
                            <Paper className="dashboard-card-base action-card">
                                <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: 200 }}>
                                    <CircularProgress />
                                </Box>
                            </Paper>
                            <Paper className="dashboard-card-base weekly-view-card">
                                <WeeklyTimeCardsSkeleton />
                            </Paper>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={3}>
                            <Paper className="dashboard-card-base profile-card">
                                <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: 200 }}>
                                    <CircularProgress />
                                </Box>
                            </Paper>
                            <Paper className="dashboard-card-base shift-info-card">
                                <ShiftInfoSkeleton />
                            </Paper>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={3}>
                            <Paper className="dashboard-card-base recent-activity-card">
                                <RecentActivitySkeleton />
                            </Paper>
                            <Paper className="dashboard-card-base saturday-schedule-card">
                                <SaturdayScheduleSkeleton />
                            </Paper>
                        </Stack>
                    </Grid>
                </Grid>
            </Box>
        );
    }

    return (
        <Box className="employee-dashboard-container">
            <Box>
                {error && ( <Alert severity="error" onClose={() => setError('')} sx={{ mb: 3 }}>{error}</Alert> )}
                {hasPendingExtraBreak && (
                    <Alert severity="info" icon={<HourglassTopIcon />} sx={{ mb: 3, '.MuiAlert-message': { width: '100%' } }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2">Your request for an extra break is pending approval.</Typography>
                            <Chip label="Pending" size="small" />
                        </Box>
                    </Alert>
                )}
                
                <Grid container spacing={3}>
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={3}>
                            <Paper className="dashboard-card-base action-card">
                                <Box>
                                    <Typography variant="h5" fontWeight="bold" className="theme-text-black">Time Tracking</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                        {dailyData.status === 'Not Clocked In' || dailyData.status === 'Clocked Out' ? 'You are currently checked out. Ready to start your day?' : `Status: ${dailyData.status}`}
                                    </Typography>
                                </Box>
                                <Box 
                                    className={`time-tracking-content ${isClockedInSession ? 'visible' : 'hidden'}`}
                                    sx={{ my: 'auto' }}
                                >
                                    <MemoizedShiftProgressBar 
                                        workedMinutes={workedMinutes} 
                                        extraMinutes={serverCalculated.unpaidBreakMinutesTaken} 
                                        status={dailyData.status} 
                                        breaks={dailyData.breaks} 
                                        sessions={dailyData.sessions}
                                        calculatedLogoutTime={dailyData.calculatedLogoutTime}
                                        clockInTime={dailyData.sessions?.[0]?.startTime}
                                    />
                                    <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="overline" color="text.secondary">WORK DURATION</Typography>
                                            <MemoizedWorkTimeTracker sessions={dailyData.sessions} breaks={dailyData.breaks} status={dailyData.status}/>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="overline" color="text.secondary">BREAK TIMER</Typography>
                                            <MemoizedBreakTimer breaks={dailyData.breaks} paidBreakAllowance={paidBreakAllowance}/>
                                        </Grid>
                                    </Grid>
                                </Box>
                                <Stack direction="row" spacing={2} sx={{ mt: 'auto', width: '100%' }}>
                                    {actionLoading ? ( 
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', py: 1 }}>
                                            <CircularProgress size={24} />
                                        </Box>
                                    ) : dailyData.status === 'Not Clocked In' || dailyData.status === 'Clocked Out' ? (
                                        canAccess.checkIn() ? (
                                            <Button fullWidth className="theme-button-red" onClick={handleClockIn}>Check In</Button>
                                        ) : (
                                            <Button fullWidth disabled className="theme-button-red">Check In (Disabled)</Button>
                                        )
                                    ) : dailyData.status === 'Clocked In' ? (
                                        <>
                                            <Tooltip title={!isAnyBreakPossible ? 'No breaks are currently available' : ''} placement="top">
                                                <span>
                                                    <Button 
                                                        variant="contained" 
                                                        className="theme-button-red theme-button-break" 
                                                        onClick={handleOpenBreakModal} 
                                                        startIcon={breakActionInFlightRef.current ? <CircularProgress size={16} color="inherit" /> : <FreeBreakfastIcon />} 
                                                        disabled={!isAnyBreakPossible || breakActionInFlightRef.current || dailyData?._breakActionInProgress}
                                                    >
                                                        {breakActionInFlightRef.current || dailyData?._breakActionInProgress ? 'Processing...' : 'Start Break'}
                                                    </Button>
                                                </span>
                                            </Tooltip>
                                            {canAccess.checkOut() ? (
                                                <Button variant="outlined" className="theme-button-checkout" onClick={handleClockOut} startIcon={<LogoutIcon />} sx={{ ml: 'auto !important' }}>Check Out</Button>
                                            ) : (
                                                <Button variant="outlined" disabled className="theme-button-checkout" startIcon={<LogoutIcon />} sx={{ ml: 'auto !important' }}>Check Out (Disabled)</Button>
                                            )}
                                        </>
                                    ) : dailyData.status === 'On Break' ? (
                                        <Button 
                                            fullWidth 
                                            variant="contained" 
                                            color="success" 
                                            className="theme-button-break-end" 
                                            onClick={handleEndBreak} 
                                            startIcon={breakActionInFlightRef.current ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                                            disabled={breakActionInFlightRef.current || dailyData?._breakActionInProgress}
                                        >
                                            {breakActionInFlightRef.current || dailyData?._breakActionInProgress ? 'Processing...' : 'End Break'}
                                        </Button>
                                    ) : null}
                                </Stack>
                            </Paper>
                            <Paper className="dashboard-card-base weekly-view-card">
                                {loading ? (
                                    <WeeklyTimeCardsSkeleton />
                                ) : (
                                    <MemoizedWeeklyTimeCards logs={weeklyLogs} shift={dailyData?.shift || contextUser?.shift} />
                                )}
                            </Paper>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={3}>
                            <Paper className="dashboard-card-base profile-card">
                                <Avatar 
                                    src={!avatarImageError ? (() => {
                                        const avatarUrl = getAvatarUrl(contextUser?.profileImageUrl);
                                        // Add cache-busting query parameter to force browser to fetch fresh image
                                        // Use profileImageUpdatedAt if available, otherwise use a stable value
                                        const cacheBuster = contextUser?.profileImageUpdatedAt || 'default';
                                        return avatarUrl ? `${avatarUrl}?v=${cacheBuster}` : undefined;
                                    })() : undefined} 
                                    key={`dashboard-avatar-${contextUser?.profileImageUrl || 'no-image'}-${contextUser?.profileImageUpdatedAt || 'default'}`}
                                    className="profile-avatar"
                                    onError={() => {
                                        setAvatarImageError(true);
                                    }}
                                    imgProps={{
                                        style: {
                                            objectFit: 'cover',
                                            width: '100%',
                                            height: '100%'
                                        },
                                        onError: (e) => {
                                            e.target.onerror = null; // Prevent infinite loop
                                            setAvatarImageError(true);
                                        }
                                    }}
                                >
                                    <Typography className="profile-avatar-letter">
                                        {contextUser.name?.charAt(0) || contextUser.fullName?.charAt(0) || 'U'}
                                    </Typography>
                                </Avatar>
                                <Typography variant="h6" className="theme-text-black" sx={{ fontWeight: 'bold', mb: 0.5 }}>{contextUser.fullName || contextUser.name}</Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Employee Code: {contextUser.employeeCode || 'N/A'}</Typography>
                                <Divider sx={{ my: 1, borderColor: 'var(--theme-red)', borderWidth: '1px', width: '50px', marginX: 'auto' }} />
                                <Chip label={contextUser.designation || contextUser.role || 'Employee'} size="small" sx={{ mt: 1, mb: 2, bgcolor: 'var(--theme-red-light)', color: 'var(--theme-red)', fontWeight: 'bold' }} />
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Typography>
                            </Paper>
                            <Paper className="dashboard-card-base shift-info-card">
                                <Typography variant="h6" gutterBottom className="theme-text-black">Today's Shift</Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Stack spacing={3} divider={<Divider flexItem />} sx={{ flexGrow: 1 }}>
                                    {loading ? (
                                        <ShiftInfoSkeleton />
                                    ) : (
                                        <MemoizedShiftInfoDisplay dailyData={dailyData} />
                                    )}
                                    <MemoizedLiveClock />
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={3} sx={{ height: '100%' }}>
                            <Paper className="dashboard-card-base recent-activity-card" sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                                    {loading ? (
                                        <RecentActivitySkeleton />
                                    ) : (
                                        <MemoizedRecentActivityCard dailyData={dailyData} />
                                    )}
                                </Box>
                            </Paper>
                            <Paper className="dashboard-card-base saturday-schedule-card" sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="h6" gutterBottom className="theme-text-black">Upcoming Saturdays</Typography>
                                <Divider sx={{ mb: 2.5 }} />
                                <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                                    {loading ? (
                                        <SaturdayScheduleSkeleton />
                                    ) : (
                                        <MemoizedSaturdaySchedule policy={contextUser?.alternateSaturdayPolicy || 'All Saturdays Working'} requests={myRequests} />
                                    )}
                                </Box>
                            </Paper>
                        </Stack>
                    </Grid>
                </Grid>

                <Dialog 
                    open={isBreakModalOpen} 
                    onClose={handleCloseBreakModal} 
                    TransitionComponent={BreakModalTransition} 
                    PaperProps={{ className: 'break-modal-paper' }}
                >
                    <DialogTitle className="break-modal-title">Choose Your Break Type<IconButton aria-label="close" onClick={handleCloseBreakModal} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton></DialogTitle>
                    <DialogContent dividers>
                        <Stack 
                            spacing={2} 
                            component={motion.div}
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <Tooltip title={!paidBreakCheck.allowed ? paidBreakCheck.message : (hasExhaustedPaidBreak ? 'You have used all your paid break time' : '')} arrow placement="left">
                                <Box component={motion.div} variants={itemVariants}>
                                    <Paper 
                                        className={`break-modal-card ${hasExhaustedPaidBreak || !paidBreakCheck.allowed || breakActionInFlightRef.current ? 'disabled' : ''}`} 
                                        onClick={!hasExhaustedPaidBreak && paidBreakCheck.allowed && !breakActionInFlightRef.current ? () => handleStartBreak('Paid') : undefined}
                                    >
                                        {breakActionInFlightRef.current ? <CircularProgress size={24} /> : <AccountBalanceWalletIcon className="break-modal-icon paid" />}
                                        <Box>
                                            <Typography variant="h6">Paid Break</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {breakActionInFlightRef.current ? 'Processing...' : `${Math.max(0, paidBreakAllowance - serverCalculated.paidMinutesTaken)} mins remaining`}
                                            </Typography>
                                        </Box>
                                    </Paper>
                                </Box>
                            </Tooltip>
                            
                            <Tooltip title={!unpaidBreakCheck.allowed ? unpaidBreakCheck.message : (hasTakenUnpaidBreak ? 'You have already taken an unpaid break today' : '')} arrow placement="left">
                                <Box component={motion.div} variants={itemVariants}>
                                    <Paper 
                                        className={`break-modal-card ${hasTakenUnpaidBreak || !unpaidBreakCheck.allowed || breakActionInFlightRef.current ? 'disabled' : ''}`} 
                                        onClick={!hasTakenUnpaidBreak && unpaidBreakCheck.allowed && !breakActionInFlightRef.current ? () => handleStartBreak('Unpaid') : undefined}
                                    >
                                        {breakActionInFlightRef.current ? <CircularProgress size={24} /> : <NoMealsIcon className="break-modal-icon unpaid" />}
                                        <Box>
                                            <Typography variant="h6">Unpaid Break</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {breakActionInFlightRef.current ? 'Processing...' : '10 minute break'}
                                            </Typography>
                                        </Box>
                                    </Paper>
                                </Box>
                            </Tooltip>

                            <Tooltip title={!extraBreakCheck.allowed ? extraBreakCheck.message : (hasPendingExtraBreak ? 'Your request is pending' : hasTakenExtraBreak ? 'You have already used an extra break' : '')} arrow placement="left">
                                <Box component={motion.div} variants={itemVariants}>
                                    <Paper 
                                        className={`break-modal-card extra ${(hasPendingExtraBreak || (!hasApprovedExtraBreak && hasTakenExtraBreak) || !extraBreakCheck.allowed || breakActionInFlightRef.current) ? 'disabled' : ''}`} 
                                        onClick={hasApprovedExtraBreak && !hasTakenExtraBreak && extraBreakCheck.allowed && !breakActionInFlightRef.current ? () => handleStartBreak('Extra') : (hasPendingExtraBreak || hasTakenExtraBreak || !extraBreakCheck.allowed || breakActionInFlightRef.current ? undefined : handleOpenReasonModal)}
                                    >
                                        {breakActionInFlightRef.current ? <CircularProgress size={24} /> : <MoreTimeIcon className="break-modal-icon extra" />}
                                        <Box>
                                            <Typography variant="h6">{hasApprovedExtraBreak ? 'Start Extra Break' : 'Request Extra Break'}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {breakActionInFlightRef.current ? 'Processing...' : (hasApprovedExtraBreak ? '10 minute approved break' : 'Requires admin approval')}
                                            </Typography>
                                        </Box>
                                    </Paper>
                                </Box>
                            </Tooltip>
                        </Stack>
                    </DialogContent>
                </Dialog>

                <Dialog open={isReasonModalOpen} onClose={handleCloseReasonModal} TransitionComponent={DialogTransition} fullWidth maxWidth="xs">
                    <DialogTitle>Request Extra Break</DialogTitle>
                    <DialogContent><Typography variant="body2" sx={{ mb: 2 }}>Please provide a reason for your request. An admin will review it shortly.</Typography><TextField autoFocus margin="dense" id="reason" label="Reason for Break" type="text" fullWidth variant="outlined" multiline rows={3} value={breakReason} onChange={(e) => setBreakReason(e.target.value)} /></DialogContent>
                    <DialogActions sx={{ p: '16px 24px' }}><Button onClick={handleCloseReasonModal} className="theme-button-checkout">Cancel</Button><Button onClick={handleRequestExtraBreak} variant="contained" className="theme-button-red" disabled={isSubmittingReason}>{isSubmittingReason ? <CircularProgress size={24} /> : "Send Request"}</Button></DialogActions>
                </Dialog>

                {/* Weekly late warning dialog (informational only) */}
                <Dialog open={weeklyLateDialog.open} onClose={() => setWeeklyLateDialog({ ...weeklyLateDialog, open: false })} TransitionComponent={DialogTransition} fullWidth maxWidth="xs">
                    <DialogTitle>Attendance Notice</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" sx={{ mb: 1 }}>You have been late <strong>{weeklyLateDialog.lateCount}</strong> time(s) this week.</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>This is an informational notice. Your account will not be locked automatically.</Typography>
                        {weeklyLateDialog.lateDates && weeklyLateDialog.lateDates.length > 0 && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Dates:</Typography>
                                <ul>
                                    {weeklyLateDialog.lateDates.map(d => (<li key={d}><Typography variant="body2">{d}</Typography></li>))}
                                </ul>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setWeeklyLateDialog({ ...weeklyLateDialog, open: false })} className="theme-button-checkout">Dismiss</Button>
                        <Button onClick={() => { setWeeklyLateDialog({ ...weeklyLateDialog, open: false }); window.location.href = '/contact-hr'; }} variant="contained" className="theme-button-red">Contact HR</Button>
                    </DialogActions>
                </Dialog>
                
                <Snackbar 
                    open={snackbar.open} 
                    autoHideDuration={4000} 
                    onClose={() => setSnackbar({ ...snackbar, open: false })} 
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert 
                        onClose={() => setSnackbar({ ...snackbar, open: false })} 
                        severity={snackbar.severity || 'info'}
                        sx={{ width: '100%' }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </Box>
    );
};

export default EmployeeDashboardPage;