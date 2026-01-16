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
import { useBreakUI } from '../context/BreakUIContext';
import { usePermissions } from '../hooks/usePermissions';
import { getCurrentLocation, getCachedLocationOnly } from '../services/locationService';
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
// CRITICAL: Use IST timezone for date string to match backend
// This ensures the frontend sends the same date as the backend expects
const getLocalDateString = (date = new Date()) => {
    // Use Intl.DateTimeFormat to get the date in IST (Asia/Kolkata)
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return istFormatter.format(date);
};


const EmployeeDashboardPage = () => {
    const { user: contextUser, updateUserContext } = useAuth();
    const { uiBreakState, startUiBreak, endUiBreak, setUiBreakState, reconcileFromBackend } = useBreakUI();
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
    const breakActionInFlightRef = useRef(false);
    const clockInActionInFlightRef = useRef(false);
    const clockOutActionInFlightRef = useRef(false);


    const isOnBreakUI = !!uiBreakState;
    // NOTE: Break UI is intentionally driven by uiBreakState (optimistic + single authority).
    // The previous implementation rendered break UI from dailyData.status / dailyData.breaks,
    // which could be overwritten by stale cached backend responses (status cache TTL) and delayed refetch/socket timing.
    const displayStatus = isOnBreakUI ? 'On Break' : dailyData?.status;
    const statusForUi = isOnBreakUI ? 'On Break' : dailyData?.status;
    const breaksForUi = useMemo(() => {
        const base = Array.isArray(dailyData?.breaks) ? dailyData.breaks : [];
        if (!uiBreakState) return base;
        const hasActive = base.some(b => b && !b.endTime);
        if (hasActive) return base;
        return [
            ...base,
            {
                _id: uiBreakState.id,
                breakType: uiBreakState.type,
                startTime: uiBreakState.startTime,
                endTime: null,
            },
        ];
    }, [dailyData?.breaks, uiBreakState]);

    const isClockedInSession = dailyData?.status === 'Clocked In' || isOnBreakUI;

    const fetchAllDataRef = useRef(null);
    
    // Create stable fetch function
    // PHASE 5: Use aggregate endpoint - single call instead of 3
    fetchAllDataRef.current = async (isInitialLoad = false) => {
        const localDate = getLocalDateString();
        
        if (isInitialLoad) {
            setLoading(true);
        }
        
        try {
            // AGGREGATE ENDPOINT: Single call replaces 3 separate calls
            const dashboardRes = await api.get(`/attendance/dashboard/employee?date=${localDate}`);
            const { dailyStatus, weeklyLogs, leaveRequests } = dashboardRes.data;
            
            setDailyData(dailyStatus);
            reconcileFromBackend(dailyStatus);
            setWeeklyLogs(Array.isArray(weeklyLogs) ? weeklyLogs : []);
            setMyRequests(Array.isArray(leaveRequests) ? leaveRequests : []);
            
            if (isInitialLoad) {
                setLoading(false);
            }
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            if (isInitialLoad) {
                setError('Failed to load dashboard data. Please refresh the page.');
                setLoading(false);
            }
            // Don't show error for background refresh - silent fail
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
            return;
        }
        
        let mounted = true;
        let intervalId = null;
        
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
            // POLLING REMOVED: Socket events + mutation refetch provide real-time updates
            // Socket listener for attendance_log_updated is already in place (lines 228-262)
            // Visibility change fallback added below for socket disconnect scenarios
        };
        
        loadData();
        
        // Fallback: Refresh on visibility change (socket disconnect recovery)
        const handleVisibilityChange = () => {
            if (!document.hidden && mounted && fetchAllDataRef.current) {
                // Only refresh if socket is disconnected (fallback safety)
                if (socket.disconnected) {
                    console.log('[EmployeeDashboard] Socket disconnected, refreshing data on visibility change');
                    fetchAllDataRef.current(false);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mounted = false;
            dataFetchedRef.current = false; // Reset on unmount
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
     }, [contextUser?.id, contextUser?._id, authLoading]); // Depend on user IDs (stable) and authLoading to trigger when auth is ready

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

    const workedMinutes = useMemo(() => {
        if (!dailyData?.sessions?.[0]?.startTime) return 0;
        const now = new Date();
        const grossTimeMs = dailyData.sessions.reduce((total, s) => total + ((s.endTime ? new Date(s.endTime) : now) - new Date(s.startTime)), 0);
        const breakTimeMs = (breaksForUi || []).reduce((total, b) => total + ((b.endTime ? new Date(b.endTime) : now) - new Date(b.startTime)), 0);
        return Math.floor(Math.max(0, grossTimeMs - breakTimeMs) / 60000);
    }, [dailyData?.sessions, breaksForUi]);
    
    const serverCalculated = useMemo(() => {
        const paidMinutesTaken = dailyData?.attendanceLog?.paidBreakMinutesTaken || 0;
        const unpaidBreakMinutesTaken = dailyData?.attendanceLog?.unpaidBreakMinutesTaken || 0;
        const paidBreakAllowance = dailyData?.shift?.paidBreakMinutes || 30;
        // Calculate paid break excess (time beyond 30 minutes)
        const paidBreakExcess = Math.max(0, paidMinutesTaken - paidBreakAllowance);
        
        return {
            penaltyMinutes: dailyData?.attendanceLog?.penaltyMinutes || 0,
            paidMinutesTaken,
            unpaidBreakMinutesTaken,
            paidBreakExcess,
        };
    }, [dailyData?.attendanceLog, dailyData?.shift]);
    
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
        
        try {
            let location = getCachedLocationOnly();
            if (!location) location = await getCurrentLocation();

            // Immediate optimistic UI update for instant feedback
            clockInActionInFlightRef.current = true;
            setActionLoading(true);
            setError('');
            const previousDailyData = dailyData;
            setDailyData(prev => ({ ...prev, status: 'Clocked In', sessions: [{ startTime: new Date().toISOString(), endTime: null }] }));
            setSnackbar({ open: true, message: 'Checked in successfully!' });

            try {
                const res = await api.post('/attendance/clock-in', location);

                // If backend signals weekly late warning (3+), show a popup but DO NOT lock account
                const warning = res?.data?.weeklyLateWarning;
                if (warning && warning.showPopup) {
                    setWeeklyLateDialog({ open: true, lateCount: warning.lateCount || 0, lateDates: warning.lateDates || [] });
                }

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
                setSnackbar({ open: true, message: 'Check in failed. Please try again.' });
            } finally {
                setActionLoading(false);
                clockInActionInFlightRef.current = false;
            }
        } catch (locationError) {
            clockInActionInFlightRef.current = false;
            setActionLoading(false);
            setError('Location access is required to clock in. Please enable location permissions.');
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
        const previousDailyData = dailyData;
        startUiBreak(breakType);
        setSnackbar({ open: true, message: `Break started successfully!` });
        
        try {
            const res = await api.post('/breaks/start', { breakType });
            const createdBreak = res?.data?.break;
            if (createdBreak && createdBreak.startTime) {
                setUiBreakState({
                    id: createdBreak._id || createdBreak.id || 'backend',
                    type: createdBreak.breakType || createdBreak.type || breakType,
                    startTime: createdBreak.startTime,
                    source: 'backend',
                });
            }
            // Refresh data from server (non-blocking for UI)
            if (fetchAllDataRef.current) {
                fetchAllDataRef.current(false).catch(err => {
                    console.error('Failed to refresh data after break start:', err);
                });
            }
        } catch (err) {
            // Revert on error
            setDailyData(previousDailyData);
            endUiBreak();
            setError(err.response?.data?.error || 'Failed to start break. Please try again.');
            setSnackbar({ open: true, message: 'Failed to start break. Please try again.' });
        } finally {
            breakActionInFlightRef.current = false;
        }
    };

    const handleEndBreak = async () => {
        if (breakActionInFlightRef.current) return;
        breakActionInFlightRef.current = true;
        setError('');
        const previousDailyData = dailyData;
        const previousUiBreakState = uiBreakState;
        
        endUiBreak();
        setSnackbar({ open: true, message: 'Break ended successfully!' });

        const activeBreak = breaksForUi?.find(b => b && !b.endTime) || null;
        const breakIdFromUi = previousUiBreakState?.id && previousUiBreakState.id !== 'local' ? previousUiBreakState.id : undefined;
        const breakIdFromData = activeBreak?._id || activeBreak?.id;
        const breakId = breakIdFromUi || breakIdFromData;

        try {
            if (breakId) {
                await api.post('/breaks/end', { breakId });
            } else {
                await api.post('/breaks/end');
            }
            if (fetchAllDataRef.current) {
                fetchAllDataRef.current(false).catch(err => {
                    console.error('Failed to refresh data after break end:', err);
                });
            }
        } catch (err) {
            setDailyData(previousDailyData);
            setUiBreakState(previousUiBreakState);
            setError(err.response?.data?.error || 'Failed to end break. Please try again.');
            setSnackbar({ open: true, message: 'Failed to end break. Please try again.' });
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
    // NON-BLOCKING: Show skeleton if authStatus is 'unknown' (auth still resolving)
    // ProtectedRoute handles most cases, but this is a safety check
    // If user is null but we're authenticated, show skeleton (user data loading)
    const { authStatus } = useAuth();
    if (authStatus === 'unknown' || !contextUser) {
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
                            <Typography variant="body2" sx={{ fontWeight: 400, letterSpacing: '0.025em' }}>Your request for an extra break is pending approval.</Typography>
                            <Chip label="Pending" size="small" sx={{ fontWeight: 500, letterSpacing: '0.025em' }} />
                        </Box>
                    </Alert>
                )}
                
                <Grid container spacing={3}>
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={3}>
                            <Paper className="dashboard-card-base action-card">
                                <Box>
                                    <Typography variant="h5" sx={{ fontWeight: 500, letterSpacing: '0.025em' }} className="theme-text-black">Time Tracking</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 400, letterSpacing: '0.025em' }}>
                                        {dailyData.status === 'Not Clocked In' || dailyData.status === 'Clocked Out' ? 'You are currently checked out. Ready to start your day?' : `Status: ${displayStatus}`}
                                    </Typography>
                                </Box>
                                <Box 
                                    className={`time-tracking-content ${isClockedInSession ? 'visible' : 'hidden'}`}
                                    sx={{ my: 'auto' }}
                                >
                                    <MemoizedShiftProgressBar 
                                        workedMinutes={workedMinutes} 
                                        unpaidBreakMinutes={serverCalculated.unpaidBreakMinutesTaken}
                                        paidBreakExcess={serverCalculated.paidBreakExcess}
                                        status={statusForUi} 
                                        breaks={breaksForUi} 
                                        sessions={dailyData.sessions} 
                                        activeBreakOverride={isOnBreakUI ? { _id: uiBreakState.id, breakType: uiBreakState.type, startTime: uiBreakState.startTime, endTime: null } : null}
                                    />
                                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                                        {isOnBreakUI ? (
                                            <MemoizedBreakTimer
                                                breaks={breaksForUi}
                                                paidBreakAllowance={paidBreakAllowance}
                                                activeBreakOverride={isOnBreakUI ? { _id: uiBreakState.id, breakType: uiBreakState.type, startTime: uiBreakState.startTime, endTime: null } : null}
                                                unifiedDisplay={true}
                                            />
                                        ) : (
                                            <MemoizedWorkTimeTracker sessions={dailyData.sessions} breaks={breaksForUi} status={statusForUi}/>
                                        )}
                                        <Typography
                                            variant="overline"
                                            sx={{
                                                mt: 1,
                                                color: 'var(--theme-black)',
                                                fontWeight: 500,
                                                fontSize: '0.75rem',
                                                letterSpacing: '0.025em'
                                            }}
                                        >
                                            {isOnBreakUI ? 'BREAK TIME' : 'WORK DURATION'}
                                        </Typography>
                                    </Box>
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
                                    ) : isOnBreakUI ? (
                                        <Button fullWidth variant="contained" color="success" className="theme-button-break-end" onClick={handleEndBreak} startIcon={<PlayArrowIcon />}>End Break</Button>
                                    ) : dailyData.status === 'Clocked In' ? (
                                        <>
                                            <Tooltip title={!isAnyBreakPossible ? 'No breaks are currently available' : ''} placement="top">
                                                <span>
                                                    <Button variant="contained" className="theme-button-red theme-button-break" onClick={handleOpenBreakModal} startIcon={<FreeBreakfastIcon />} disabled={!isAnyBreakPossible}>Start Break</Button>
                                                </span>
                                            </Tooltip>
                                            {canAccess.checkOut() ? (
                                                <Button variant="outlined" className="theme-button-checkout" onClick={handleClockOut} startIcon={<LogoutIcon />} sx={{ ml: 'auto !important' }}>Check Out</Button>
                                            ) : (
                                                <Button variant="outlined" disabled className="theme-button-checkout" startIcon={<LogoutIcon />} sx={{ ml: 'auto !important' }}>Check Out (Disabled)</Button>
                                            )}
                                        </>
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
                                <Box className="profile-card-inner">
                                    <Avatar className="profile-avatar">
                                        <Typography className="profile-avatar-letter">
                                            {contextUser.name?.charAt(0) || contextUser.fullName?.charAt(0) || 'U'}
                                        </Typography>
                                    </Avatar>
                                    <Stack spacing={1} alignItems="center" className="profile-details-stack">
                                        <Typography variant="h6" className="profile-card-name theme-text-black">
                                            {contextUser.fullName || contextUser.name}
                                        </Typography>
                                        <Typography variant="body2" className="profile-card-code">
                                            Employee Code: {contextUser.employeeCode || 'N/A'}
                                        </Typography>
                                        <Divider className="profile-card-divider" />
                                        <Chip
                                            label={contextUser.designation || contextUser.role || 'Employee'}
                                            size="small"
                                            className="profile-card-role-badge"
                                        />
                                        <Typography variant="body2" className="profile-card-date">
                                            {new Date().toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </Typography>
                                    </Stack>
                                </Box>
                            </Paper>
                            <Paper className="dashboard-card-base shift-info-card">
                                <Typography variant="h6" gutterBottom className="theme-text-black" sx={{ fontWeight: 500, letterSpacing: '0.025em' }}>Today's Shift</Typography>
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
                                <Typography variant="h6" gutterBottom className="theme-text-black" sx={{ fontWeight: 500, letterSpacing: '0.025em' }}>Upcoming Saturdays</Typography>
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
                                    <Paper className={`break-modal-card ${hasExhaustedPaidBreak || !paidBreakCheck.allowed ? 'disabled' : ''}`} onClick={!hasExhaustedPaidBreak && paidBreakCheck.allowed ? () => handleStartBreak('Paid') : undefined}><AccountBalanceWalletIcon className="break-modal-icon paid" /><Box><Typography variant="h6" sx={{ fontWeight: 500, letterSpacing: '0.025em' }}>Paid Break</Typography><Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, letterSpacing: '0.025em' }}>{Math.max(0, paidBreakAllowance - serverCalculated.paidMinutesTaken)} mins remaining</Typography></Box></Paper>
                                </Box>
                            </Tooltip>
                            
                            <Tooltip title={!unpaidBreakCheck.allowed ? unpaidBreakCheck.message : (hasTakenUnpaidBreak ? 'You have already taken an unpaid break today' : '')} arrow placement="left">
                                <Box component={motion.div} variants={itemVariants}>
                                    <Paper className={`break-modal-card ${hasTakenUnpaidBreak || !unpaidBreakCheck.allowed ? 'disabled' : ''}`} onClick={!hasTakenUnpaidBreak && unpaidBreakCheck.allowed ? () => handleStartBreak('Unpaid') : undefined}><NoMealsIcon className="break-modal-icon unpaid" /><Box><Typography variant="h6" sx={{ fontWeight: 500, letterSpacing: '0.025em' }}>Unpaid Break</Typography><Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, letterSpacing: '0.025em' }}>10 minute break</Typography></Box></Paper>
                                </Box>
                            </Tooltip>

                            <Tooltip title={!extraBreakCheck.allowed ? extraBreakCheck.message : (hasPendingExtraBreak ? 'Your request is pending' : hasTakenExtraBreak ? 'You have already used an extra break' : '')} arrow placement="left">
                                <Box component={motion.div} variants={itemVariants}>
                                    <Paper className={`break-modal-card extra ${(hasPendingExtraBreak || (!hasApprovedExtraBreak && hasTakenExtraBreak) || !extraBreakCheck.allowed) ? 'disabled' : ''}`} onClick={hasApprovedExtraBreak && !hasTakenExtraBreak && extraBreakCheck.allowed ? () => handleStartBreak('Extra') : (hasPendingExtraBreak || hasTakenExtraBreak || !extraBreakCheck.allowed ? undefined : handleOpenReasonModal)}><MoreTimeIcon className="break-modal-icon extra" /><Box><Typography variant="h6" sx={{ fontWeight: 500, letterSpacing: '0.025em' }}>{hasApprovedExtraBreak ? 'Start Extra Break' : 'Request Extra Break'}</Typography><Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, letterSpacing: '0.025em' }}>{hasApprovedExtraBreak ? '10 minute approved break' : 'Requires admin approval'}</Typography></Box></Paper>
                                </Box>
                            </Tooltip>
                        </Stack>
                    </DialogContent>
                </Dialog>

                <Dialog open={isReasonModalOpen} onClose={handleCloseReasonModal} TransitionComponent={DialogTransition} fullWidth maxWidth="xs">
                    <DialogTitle sx={{ fontWeight: 500, letterSpacing: '0.025em' }}>Request Extra Break</DialogTitle>
                    <DialogContent><Typography variant="body2" sx={{ mb: 2, fontWeight: 400, letterSpacing: '0.025em' }}>Please provide a reason for your request. An admin will review it shortly.</Typography><TextField autoFocus margin="dense" id="reason" label="Reason for Break" type="text" fullWidth variant="outlined" multiline rows={3} value={breakReason} onChange={(e) => setBreakReason(e.target.value)} /></DialogContent>
                    <DialogActions sx={{ p: '16px 24px' }}><Button onClick={handleCloseReasonModal} className="theme-button-checkout">Cancel</Button><Button onClick={handleRequestExtraBreak} variant="contained" className="theme-button-red" disabled={isSubmittingReason}>{isSubmittingReason ? <CircularProgress size={24} /> : "Send Request"}</Button></DialogActions>
                </Dialog>

                {/* Weekly late warning dialog (informational only) */}
                <Dialog open={weeklyLateDialog.open} onClose={() => setWeeklyLateDialog({ ...weeklyLateDialog, open: false })} TransitionComponent={DialogTransition} fullWidth maxWidth="xs">
                    <DialogTitle sx={{ fontWeight: 500, letterSpacing: '0.025em' }}>Attendance Notice</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" sx={{ mb: 1, fontWeight: 400, letterSpacing: '0.025em' }}>You have been late <strong>{weeklyLateDialog.lateCount}</strong> time(s) this week.</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 400, letterSpacing: '0.025em' }}>This is an informational notice. Your account will not be locked automatically.</Typography>
                        {weeklyLateDialog.lateDates && weeklyLateDialog.lateDates.length > 0 && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500, letterSpacing: '0.025em' }}>Dates:</Typography>
                                <ul>
                                    {weeklyLateDialog.lateDates.map(d => (<li key={d}><Typography variant="body2" sx={{ fontWeight: 400, letterSpacing: '0.025em' }}>{d}</Typography></li>))}
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
                    message={snackbar.message}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                />
            </Box>
        </Box>
    );
};

export default EmployeeDashboardPage;