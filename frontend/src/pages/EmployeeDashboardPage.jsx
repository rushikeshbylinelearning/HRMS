// frontend/src/pages/EmployeeDashboardPage.jsx
import React, { useState, useEffect, useCallback, useMemo, memo, useRef, forwardRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    Typography, Button, CircularProgress, Alert, Stack, Box, Grid, Paper, 
    Avatar, Divider, Chip, IconButton, Dialog, DialogTitle, DialogContent, 
    DialogActions, Slide, TextField, Snackbar, Tooltip
} from '@mui/material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { getCurrentLocation, getCachedLocationOnly } from '../services/locationService';
import { getAvatarUrl } from '../utils/avatarUtils';
import WorkTimeTracker from '../components/WorkTimeTracker';
import BreakTimer from '../components/BreakTimer';
import ShiftInfoDisplay from '../components/ShiftInfoDisplay';
import WeeklyTimeCards from '../components/WeeklyTimeCards';
import LiveClock from '../components/LiveClock';
import SaturdaySchedule from '../components/SaturdaySchedule';
import RecentActivityCard from '../components/RecentActivityCard';
import ShiftProgressBar from '../components/ShiftProgressBar';
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
    const [now, setNow] = useState(new Date()); 
    const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
    
    const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
    const [breakReason, setBreakReason] = useState('');
    const [isSubmittingReason, setIsSubmittingReason] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });
    const [weeklyLateDialog, setWeeklyLateDialog] = useState({ open: false, lateCount: 0, lateDates: [] });
    const [avatarImageError, setAvatarImageError] = useState(false);


    const isClockedInSession = dailyData?.status === 'Clocked In' || dailyData?.status === 'On Break';

    useEffect(() => {
        if (isClockedInSession) {
            const timerId = setInterval(() => setNow(new Date()), 1000);
            return () => clearInterval(timerId);
        }
    }, [isClockedInSession]);

    const fetchAllData = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) setLoading(true);
        const localDate = getLocalDateString();
        try {
            const [statusRes, weeklyRes, requestsRes] = await Promise.all([
                api.get(`/attendance/status?date=${localDate}`),
                api.get('/attendance/my-weekly-log'),
                api.get('/leaves/my-requests'),
            ]);
            setDailyData(statusRes.data);
            setWeeklyLogs(Array.isArray(weeklyRes.data) ? weeklyRes.data : []);
            setMyRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            setError('Failed to load dashboard data. Please refresh the page.');
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    }, []);

    useEffect(() => { 
        fetchAllData(true);
        const interval = setInterval(() => {
            fetchAllData(false);
        }, 30000);
        return () => clearInterval(interval);
     }, [fetchAllData]);

    useEffect(() => {
        if (location.state?.refresh) {
            console.log("Dashboard received refresh signal, refetching data...");
            fetchAllData(false);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, fetchAllData]);

    // Reset avatar error state when profile image URL changes
    useEffect(() => {
        setAvatarImageError(false);
    }, [contextUser?.profileImageUrl]);

    const workedMinutes = useMemo(() => {
        if (!dailyData?.sessions?.[0]?.startTime) return 0;
        const grossTimeMs = dailyData.sessions.reduce((total, s) => total + ((s.endTime ? new Date(s.endTime) : now) - new Date(s.startTime)), 0);
        const breakTimeMs = (dailyData.breaks || []).reduce((total, b) => total + ((b.endTime ? new Date(b.endTime) : now) - new Date(b.startTime)), 0);
        return Math.floor(Math.max(0, grossTimeMs - breakTimeMs) / 60000);
    }, [dailyData, now]);
    
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
    
    const paidBreakCheck = useMemo(() => breakLimits.canTakeBreakNow('Paid'), [breakLimits, now]);
    const unpaidBreakCheck = useMemo(() => breakLimits.canTakeBreakNow('Unpaid'), [breakLimits, now]);
    const extraBreakCheck = useMemo(() => breakLimits.canTakeBreakNow('Extra'), [breakLimits, now]);

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
        try {
            let location = getCachedLocationOnly();
            if (!location) location = await getCurrentLocation();

            // Optimistic UI update
            setActionLoading(true);
            const previousDailyData = dailyData;
            setDailyData(prev => ({ ...prev, status: 'Clocked In', sessions: [{ startTime: new Date().toISOString(), endTime: null }] }));

            try {
                const res = await api.post('/attendance/clock-in', location);

                // If backend signals weekly late warning (3+), show a popup but DO NOT lock account
                const warning = res?.data?.weeklyLateWarning;
                if (warning && warning.showPopup) {
                    setWeeklyLateDialog({ open: true, lateCount: warning.lateCount || 0, lateDates: warning.lateDates || [] });
                }

                // Refresh data from server
                await fetchAllData();
            } catch (err) {
                // Revert optimistic update on error and show message
                setDailyData(previousDailyData);
                setError(err.response?.data?.error || 'Failed to clock in.');
            } finally {
                setActionLoading(false);
            }
        } catch (locationError) {
            setError('Location access is required to clock in. Please enable location permissions.');
        }
    };
    const handleClockOut = () => handleActionWithOptimisticUpdate(() => api.post('/attendance/clock-out'), () => setDailyData(prev => ({ ...prev, status: 'Clocked Out' })));
    const handleStartBreak = (breakType) => {
        setIsBreakModalOpen(false);
        handleActionWithOptimisticUpdate(() => api.post('/breaks/start', { breakType }), () => setDailyData(prev => ({ ...prev, status: 'On Break', breaks: [...(prev.breaks || []), { breakType, startTime: new Date().toISOString(), endTime: null }] })));
    };
    const handleEndBreak = () => handleActionWithOptimisticUpdate(() => api.post('/breaks/end'), () => setDailyData(prev => ({ ...prev, status: 'Clocked In' })));
    
    const handleRequestExtraBreak = async () => {
        if (!breakReason.trim()) { setError("Please provide a reason."); return; }
        setIsSubmittingReason(true); setError('');
        try {
            await api.post('/breaks/request-extra', { reason: breakReason });
            setSnackbar({ open: true, message: 'Request sent for approval.' });
            handleCloseReasonModal();
            await fetchAllData();
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
    // Guard against rendering if the main user object or the component's own data is still loading.
    if (loading || !contextUser) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }
    // ### END OF FIX ###
    // =================================================================
    
    if (!dailyData) return <Alert severity="warning" sx={{ m: 3 }}>Could not load critical attendance data. Please try again.</Alert>;

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
                                {isClockedInSession && (
                                    <Box sx={{ my: 'auto' }}>
                                        <MemoizedShiftProgressBar workedMinutes={workedMinutes} extraMinutes={serverCalculated.unpaidBreakMinutesTaken} status={dailyData.status} breaks={dailyData.breaks} sessions={dailyData.sessions} />
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
                                )}
                                <Stack direction="row" spacing={2} sx={{ mt: 'auto', width: '100%' }}>
                                    {actionLoading ? ( <CircularProgress /> ) : dailyData.status === 'Not Clocked In' || dailyData.status === 'Clocked Out' ? (
                                        canAccess.checkIn() ? (
                                            <Button fullWidth className="theme-button-red" onClick={handleClockIn}>Check In</Button>
                                        ) : (
                                            <Button fullWidth disabled className="theme-button-red">Check In (Disabled)</Button>
                                        )
                                    ) : dailyData.status === 'Clocked In' ? (
                                        <>
                                            <Tooltip title={!isAnyBreakPossible ? 'No breaks are currently available' : ''} placement="top">
                                                <span>
                                                    <Button variant="contained" className="theme-button-red" onClick={handleOpenBreakModal} startIcon={<FreeBreakfastIcon />} disabled={!isAnyBreakPossible}>Start Break</Button>
                                                </span>
                                            </Tooltip>
                                            {canAccess.checkOut() ? (
                                                <Button variant="outlined" className="theme-button-checkout" onClick={handleClockOut} startIcon={<LogoutIcon />} sx={{ ml: 'auto !important' }}>Check Out</Button>
                                            ) : (
                                                <Button variant="outlined" disabled className="theme-button-checkout" startIcon={<LogoutIcon />} sx={{ ml: 'auto !important' }}>Check Out (Disabled)</Button>
                                            )}
                                        </>
                                    ) : dailyData.status === 'On Break' ? (
                                        <Button fullWidth variant="contained" color="success" onClick={handleEndBreak} startIcon={<PlayArrowIcon />}>End Break</Button>
                                    ) : null}
                                </Stack>
                            </Paper>
                            <Paper className="dashboard-card-base weekly-view-card">
                                <MemoizedWeeklyTimeCards logs={weeklyLogs} shift={dailyData?.shift || contextUser?.shift} />
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
                                        // Use profileImageUpdatedAt if available, otherwise use current timestamp
                                        const cacheBuster = contextUser?.profileImageUpdatedAt || Date.now();
                                        return avatarUrl ? `${avatarUrl}?v=${cacheBuster}` : undefined;
                                    })() : undefined} 
                                    key={`dashboard-avatar-${contextUser?.profileImageUrl || 'no-image'}-${contextUser?.profileImageUpdatedAt || Date.now()}`}
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
                                    <MemoizedShiftInfoDisplay dailyData={dailyData} />
                                    <MemoizedLiveClock />
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <Stack spacing={3} sx={{ height: '100%' }}>
                            <Paper className="dashboard-card-base recent-activity-card" sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ flexGrow: 1, overflowY: 'auto' }}><MemoizedRecentActivityCard dailyData={dailyData} /></Box>
                            </Paper>
                            <Paper className="dashboard-card-base saturday-schedule-card" sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="h6" gutterBottom className="theme-text-black">Upcoming Saturdays</Typography>
                                <Divider sx={{ mb: 2.5 }} />
                                <Box sx={{ flexGrow: 1, overflowY: 'auto' }}><MemoizedSaturdaySchedule policy={contextUser?.alternateSaturdayPolicy || 'All Saturdays Working'} requests={myRequests} /></Box>
                            </Paper>
                        </Stack>
                    </Grid>
                </Grid>

                <Dialog open={isBreakModalOpen} onClose={handleCloseBreakModal} TransitionComponent={DialogTransition} PaperProps={{ className: 'break-modal-paper' }}>
                    <DialogTitle className="break-modal-title">Choose Your Break Type<IconButton aria-label="close" onClick={handleCloseBreakModal} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton></DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            <Tooltip title={!paidBreakCheck.allowed ? paidBreakCheck.message : (hasExhaustedPaidBreak ? 'You have used all your paid break time' : '')} arrow placement="left">
                                <Box>
                                    <Paper className={`break-modal-card ${hasExhaustedPaidBreak || !paidBreakCheck.allowed ? 'disabled' : ''}`} onClick={!hasExhaustedPaidBreak && paidBreakCheck.allowed ? () => handleStartBreak('Paid') : undefined}><AccountBalanceWalletIcon className="break-modal-icon paid" /><Box><Typography variant="h6">Paid Break</Typography><Typography variant="body2" color="text.secondary">{Math.max(0, paidBreakAllowance - serverCalculated.paidMinutesTaken)} mins remaining</Typography></Box></Paper>
                                </Box>
                            </Tooltip>
                            
                            <Tooltip title={!unpaidBreakCheck.allowed ? unpaidBreakCheck.message : (hasTakenUnpaidBreak ? 'You have already taken an unpaid break today' : '')} arrow placement="left">
                                <Box>
                                    <Paper className={`break-modal-card ${hasTakenUnpaidBreak || !unpaidBreakCheck.allowed ? 'disabled' : ''}`} onClick={!hasTakenUnpaidBreak && unpaidBreakCheck.allowed ? () => handleStartBreak('Unpaid') : undefined}><NoMealsIcon className="break-modal-icon unpaid" /><Box><Typography variant="h6">Unpaid Break</Typography><Typography variant="body2" color="text.secondary">10 minute break</Typography></Box></Paper>
                                </Box>
                            </Tooltip>

                            <Tooltip title={!extraBreakCheck.allowed ? extraBreakCheck.message : (hasPendingExtraBreak ? 'Your request is pending' : hasTakenExtraBreak ? 'You have already used an extra break' : '')} arrow placement="left">
                                <Box>
                                    <Paper className={`break-modal-card extra ${(hasPendingExtraBreak || (!hasApprovedExtraBreak && hasTakenExtraBreak) || !extraBreakCheck.allowed) ? 'disabled' : ''}`} onClick={hasApprovedExtraBreak && !hasTakenExtraBreak && extraBreakCheck.allowed ? () => handleStartBreak('Extra') : (hasPendingExtraBreak || hasTakenExtraBreak || !extraBreakCheck.allowed ? undefined : handleOpenReasonModal)}><MoreTimeIcon className="break-modal-icon extra" /><Box><Typography variant="h6">{hasApprovedExtraBreak ? 'Start Extra Break' : 'Request Extra Break'}</Typography><Typography variant="body2" color="text.secondary">{hasApprovedExtraBreak ? '10 minute approved break' : 'Requires admin approval'}</Typography></Box></Paper>
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
                
                <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} message={snackbar.message} />
            </Box>
        </Box>
    );
};

export default EmployeeDashboardPage;