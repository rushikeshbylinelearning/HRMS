// frontend/src/pages/AdminDashboardPage.jsx
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Alert, Avatar, Button, Tooltip, Snackbar, Chip, Dialog, DialogTitle, DialogContent, Typography, Box, DialogActions, Stack, Skeleton } from '@mui/material';
import {
    PeopleAlt as PeopleAltIcon,
    Work as WorkIcon,
    AccessAlarm as AccessAlarmIcon,
    EventBusy as EventBusyIcon,
    Link as LinkIcon,
    Notes as NotesIcon,
    MoreTime as MoreTimeIcon,
    HistoryEdu as HistoryEduIcon,
    Assessment as AssessmentIcon,
} from '@mui/icons-material';
import EmployeeListModal from '../components/EmployeeListModal';
import EnhancedLeaveRequestModal from '../components/EnhancedLeaveRequestModal';
import PageHeroHeader from '../components/PageHeroHeader';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import DashboardIcon from '@mui/icons-material/Dashboard';
import socket from '../socket';

import '../styles/AdminDashboardPage.css';

// --- Memoized Child Components ---
const SummaryCard = memo(({ title, value, icon, iconBgClass, onClick, clickable = false }) => (
    <div 
        className={`card summary-card ${clickable ? 'clickable-card' : ''}`}
        onClick={clickable ? onClick : undefined}
        style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
        <div className="summary-card-content">
            <div className="title">{title}</div>
            <div className="value">{value}</div>
        </div>
        <div className={`summary-card-icon ${iconBgClass}`}>{icon}</div>
    </div>
));

const RequestItem = memo(({ request, onStatusChange, onViewDetails }) => (
    <div 
        className="request-item" 
        onClick={onViewDetails}
        style={{ cursor: 'pointer' }}
    >
        <Tooltip title={`${request.reason}`} placement="top-start">
            <div className="request-info">
                <strong>{request.employee.fullName}</strong>
                <span className="date">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
        </Tooltip>
        <div className="applied-date">
            {request.leaveDates && request.leaveDates.length > 0 
                ? new Date(request.leaveDates[0]).toLocaleDateString()
                : 'N/A'}
        </div>
        <div><Chip label={formatLeaveRequestType(request.requestType)} size="small" variant="outlined" /></div>
        <div className="request-actions" onClick={(e) => e.stopPropagation()}>
            <Button size="small" variant="contained" color="success" onClick={() => onStatusChange(request._id, 'Approved')}>Approve</Button>
            <Button size="small" variant="outlined" color="error" onClick={() => onStatusChange(request._id, 'Rejected')}>Reject</Button>
        </div>
    </div>
));

const WhosInItem = memo(({ employee }) => {
    const [liveLogoutTime, setLiveLogoutTime] = useState(null);
    const dataReceivedTimeRef = useRef(null);
    const intervalRef = useRef(null);
    const rafRef = useRef(null);
    const lastTimeStringRef = useRef('');

    useEffect(() => {
        // Clear any existing timers
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        if (!employee.calculatedLogoutTime) {
            if (liveLogoutTime !== null) {
                setLiveLogoutTime(null);
            }
            dataReceivedTimeRef.current = null;
            return;
        }

        // Store when we received this data
        dataReceivedTimeRef.current = new Date();
        const baseLogoutTime = new Date(employee.calculatedLogoutTime);
        setLiveLogoutTime(baseLogoutTime);

        // If there's an active unpaid break, update logout time dynamically
        // BACKEND-AUTHORITATIVE: Use server-calculated logout time directly
        // The backend already includes active break duration in its calculation
        // Frontend only displays the authoritative backend value
        setLiveLogoutTime(baseLogoutTime);
        
        // Clear any existing timers
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        
        // Note: For real-time updates, the parent component should refresh employee data
        // via socket events or periodic API calls. The backend recalculates on each call.
    }, [employee.calculatedLogoutTime, employee.activeBreak]);

    const formatTime = (time) => {
        if (!time) return 'N/A';
        return new Date(time).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    };

    return (
        <div className="whos-in-item">
            <Avatar sx={{ bgcolor: 'var(--accent-teal)' }}>
                {employee.fullName.charAt(0)}
            </Avatar>
            <div className="item-details">
                <div className="name">{employee.fullName}</div>
                <div className="role">{employee.designation}</div>
            </div>
            <div className="item-times">
                <div className="time-column">
                    <div className="time-label">Log In</div>
                    <div className="time-value">
                        {formatTime(employee.startTime)}
                    </div>
                </div>
                <div className="time-column">
                    <div className="time-label">Required Log Out</div>
                    <div className="time-value logout-time">
                        {liveLogoutTime ? formatTime(liveLogoutTime) : 'N/A'}
                    </div>
                </div>
            </div>
        </div>
    );
});

const ActivityItem = memo(({ item, onClick }) => {
    const isBreakRequest = item.type === 'ExtraBreakRequest';
    const isLeaveRequest = item.type === 'BackdatedLeaveRequest';
    
    
    const getProps = () => {
        if (isBreakRequest) {
            return { icon: <MoreTimeIcon sx={{fontSize: '1rem'}}/>, chipLabel: 'Break Request', avatarBg: 'var(--accent-purple)', chipClass: 'activity-chip-break' };
        }
        if (isLeaveRequest) {
            return { icon: <HistoryEduIcon sx={{fontSize: '1rem'}}/>, chipLabel: 'Backdate Leave', avatarBg: 'var(--accent-orange)', chipClass: 'activity-chip-leave' };
        }
        // Default is Note
        return { icon: item.user.fullName.charAt(0), chipLabel: null, avatarBg: 'var(--accent-blue)', chipClass: '' };
    };

    const { icon, chipLabel, avatarBg, chipClass } = getProps();

    return (
        <div className="activity-item" onClick={onClick}>
            <Avatar sx={{ bgcolor: avatarBg, width: 32, height: 32, fontSize: '0.9rem' }}>
                {icon}
            </Avatar>
            <div className="activity-details">
                <div className="name">
                    {item.user.fullName}
                    {chipLabel && <Chip label={chipLabel} size="small" className={`activity-chip ${chipClass}`} />}
                </div>
                <div className="activity-preview">"{item.content}"</div>
            </div>
            <div className="activity-time">
                {new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    );
});


const AdminDashboardPage = () => {
    // Get auth state at component level (will be used in useEffect)
    const { user, loading: authLoading } = useAuth();
    const [summary, setSummary] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [selectedCardType, setSelectedCardType] = useState(null);
    const [selectedCardTitle, setSelectedCardTitle] = useState('');
    const [viewLeaveRequestDialog, setViewLeaveRequestDialog] = useState({ open: false, request: null });

    // =================================================================
    // NON-BLOCKING: Show skeleton if authStatus is 'unknown' (auth still resolving)
    // ProtectedRoute handles most cases, but this is a safety check
    // If user is null but we're authenticated, show skeleton (user data loading)
    const { authStatus } = useAuth();
    const authReady = authStatus !== 'unknown' && !!user;
    // =================================================================

    const fetchAllDataRef = useRef(null);
    
    // Create stable fetch function
    // PHASE 5: Use aggregate endpoint - single call instead of 2
    fetchAllDataRef.current = async (isInitialLoad = false) => {
        if (isInitialLoad) setLoading(true);
        setError('');
        try {
            // AGGREGATE ENDPOINT: Single call replaces 2 separate calls
            const dashboardRes = await api.get('/admin/dashboard-summary', {
                params: {
                    includePendingLeaves: true,
                    pendingPage: 1,
                    pendingLimit: 20
                }
            });
            const { summary, pendingLeaveRequests } = dashboardRes.data;
            
            setSummary(summary);
            // Sort pending requests by createdAt in descending order (latest first)
            const sortedRequests = Array.isArray(pendingLeaveRequests) 
                ? [...pendingLeaveRequests].sort((a, b) => {
                    const dateA = new Date(a.createdAt || 0);
                    const dateB = new Date(b.createdAt || 0);
                    return dateB - dateA; // Descending order (newest first)
                })
                : [];
            setPendingRequests(sortedRequests);
        } catch (err) {
            setError('Failed to load dashboard data. Please try again later.');
            console.error(err);
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    };
    
    const fetchAllData = useCallback((isInitialLoad = false) => {
        return fetchAllDataRef.current?.(isInitialLoad);
    }, []);

    // Guard ref for React StrictMode duplicate execution prevention
    const dataFetchedRef = useRef(false);
    
    useEffect(() => {
        // CRITICAL FIX: Guard API calls - only execute if auth is ready and user is authenticated
        // This prevents API calls during page refresh before auth state is restored
        if (authLoading || !user) {
            console.log('[AdminDashboard] Waiting for auth to initialize...');
            return;
        }
        
        let mounted = true;
        let intervalId = null;
        
        const loadData = async () => {
            // Prevent duplicate execution in React StrictMode
            if (dataFetchedRef.current) {
                console.log('[AdminDashboard] Data fetch already in progress, skipping duplicate call');
                return;
            }
            dataFetchedRef.current = true;
            
            if (fetchAllDataRef.current) {
                await fetchAllDataRef.current(true);
            }
            // POLLING REMOVED: Socket events + mutation refetch provide real-time updates
            // Visibility change fallback added below for socket disconnect scenarios
        };
        
        loadData();
        
        // Fallback: Refresh on visibility change (socket disconnect recovery)
        const handleVisibilityChange = () => {
            if (!document.hidden && mounted && fetchAllDataRef.current) {
                // Only refresh if socket is disconnected (fallback safety)
                if (socket.disconnected) {
                    console.log('[AdminDashboard] Socket disconnected, refreshing data on visibility change');
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
    }, [user?.id, user?._id, authLoading]); // Depend on user IDs (stable) and loading to trigger when auth is ready

    // Real-time consistency: refetch dashboard summary on relevant socket events (throttled, no polling)
    useEffect(() => {
        if (!authReady) return;

        const THROTTLE_MS = 1500;
        let lastRun = 0;
        let scheduledTimer = null;

        const runRefetch = async () => {
            if (!fetchAllDataRef.current) return;
            lastRun = Date.now();
            try {
                await fetchAllDataRef.current(false);
            } catch (e) {
                // Swallow to avoid breaking socket handler; error UI is managed by fetchAllData
            }
        };

        const scheduleRefetch = () => {
            const now = Date.now();
            const elapsed = now - lastRun;
            if (elapsed >= THROTTLE_MS) {
                runRefetch();
                return;
            }
            if (scheduledTimer) return;
            scheduledTimer = setTimeout(() => {
                scheduledTimer = null;
                runRefetch();
            }, THROTTLE_MS - elapsed);
        };

        const handleDashboardRelevantEvent = () => {
            // Avoid unnecessary refresh when tab is hidden
            if (document.hidden) return;
            scheduleRefetch();
        };

        socket.on('attendance_log_updated', handleDashboardRelevantEvent);
        socket.on('leave_request_updated', handleDashboardRelevantEvent);
        // Safe subscription (may not be emitted yet in some deployments)
        socket.on('leave_status_updated', handleDashboardRelevantEvent);

        return () => {
            socket.off('attendance_log_updated', handleDashboardRelevantEvent);
            socket.off('leave_request_updated', handleDashboardRelevantEvent);
            socket.off('leave_status_updated', handleDashboardRelevantEvent);
            if (scheduledTimer) {
                clearTimeout(scheduledTimer);
                scheduledTimer = null;
            }
        };
    }, [authReady]);

    const handleRequestStatusChange = async (requestId, status) => {
        const originalRequests = [...pendingRequests];
        setPendingRequests(prevRequests => prevRequests.filter(req => req._id !== requestId));
        try {
            await api.patch(`/admin/leaves/${requestId}/status`, { status });
            setSnackbar({ open: true, message: `Leave request has been ${status.toLowerCase()}.` });
        } catch (err) {
            setPendingRequests(originalRequests);
            setError(err.response?.data?.error || 'Action failed. Please try again.');
        }
    };

    
    const handleActivityResponse = async (activityId, status, type) => {
        setActionLoading(true);
        let endpoint = '';
        if (type === 'ExtraBreakRequest') {
            endpoint = `/admin/breaks/extra/${activityId}/status`;
        } else if (type === 'BackdatedLeaveRequest') {
            endpoint = `/admin/leaves/${activityId}/status`;
        } else {
            setActionLoading(false);
            return;
        }

        try {
            await api.patch(endpoint, { status });
            setSnackbar({ open: true, message: `Request has been ${status.toLowerCase()}.` });
            handleCloseActivityModal();
            if (fetchAllDataRef.current) {
                await fetchAllDataRef.current(false); // Refresh data
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to action request.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenActivityModal = (activity) => {
        setSelectedActivity(activity);
        setIsActivityModalOpen(true);
    };

    const handleCloseActivityModal = () => {
        setIsActivityModalOpen(false);
        setSelectedActivity(null);
    };

    const handleCardClick = useCallback((cardType, cardTitle) => {
        setSelectedCardType(cardType);
        setSelectedCardTitle(cardTitle);
        setIsEmployeeModalOpen(true);
    }, []);

    const handleCloseEmployeeModal = () => {
        setIsEmployeeModalOpen(false);
        setSelectedCardType(null);
        setSelectedCardTitle('');
    };

    const handleViewLeaveRequestDetails = (request) => {
        setViewLeaveRequestDialog({ open: true, request });
    };

    const handleCloseLeaveRequestDetails = () => {
        setViewLeaveRequestDialog({ open: false, request: null });
    };

    const summaryCardsData = useMemo(() => (
        summary ? [
            { 
                title: 'Employees Present', 
                value: `${summary.presentCount || 0}`, 
                icon: <WorkIcon />, 
                iconBgClass: 'icon-bg-blue',
                cardType: 'present',
                clickable: true,
                onClick: () => handleCardClick('present', 'Employees Present')
            },
            { 
                title: 'Late Comers', 
                value: summary.lateCount || 0, 
                icon: <AccessAlarmIcon />, 
                iconBgClass: 'icon-bg-orange',
                cardType: 'late',
                clickable: true,
                onClick: () => handleCardClick('late', 'Late Comers')
            },
            { 
                title: 'On Leave', 
                value: summary.onLeaveCount || 0, 
                icon: <EventBusyIcon />, 
                iconBgClass: 'icon-bg-red',
                cardType: 'on-leave',
                clickable: true,
                onClick: () => handleCardClick('on-leave', 'On Leave')
            },
            { 
                title: 'Total Employees', 
                value: summary.totalEmployees || 0, 
                icon: <PeopleAltIcon />, 
                iconBgClass: 'icon-bg-teal',
                cardType: 'total',
                clickable: true,
                onClick: () => handleCardClick('total', 'Total Employees')
            }
        ] : Array(4).fill({}).map((_, i) => ({ key: `skeleton-${i}` }))
    ), [summary, handleCardClick]);

    // Filter recent activity to show only items from the last 3 hours
    const filteredRecentActivity = useMemo(() => {
        if (!summary?.recentActivity) return [];
        
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours in milliseconds
        
        return summary.recentActivity.filter(item => {
            if (!item.timestamp) return false;
            const itemTime = new Date(item.timestamp);
            return itemTime >= threeHoursAgo;
        });
    }, [summary]);


    const showSkeletons = !authReady || loading || !summary;

    return (
        <div className="dashboard-page-container">
            <PageHeroHeader
                eyebrow="Overview"
                title="Admin Dashboard"
                description="Monitor employee attendance, manage leave requests, and track real-time activity across your organization."
                icon={<DashboardIcon />}
            />
            
            {error && <Alert severity="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}
            
            {/* Top Row: 4 Small Summary Cards */}
            <div className="top-cards-grid">
                {showSkeletons ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                        <div key={`summary-skel-${idx}`} className="card summary-card">
                            <div className="summary-card-content">
                                <div className="title"><Skeleton width="60%" /></div>
                                <div className="value"><Skeleton width="40%" height={40} /></div>
                            </div>
                            <div className="summary-card-icon icon-bg-teal">
                                <Skeleton variant="circular" width={32} height={32} />
                            </div>
                        </div>
                    ))
                ) : (
                    summaryCardsData.map((card, index) => (
                        <SummaryCard key={card.key || index} {...card} />
                    ))
                )}
            </div>

            {/* Bottom Row: 3 Large Cards */}
            <div className="bottom-cards-grid">
                {/* Left Large Card: Pending Leave Requests */}
                <div className="large-card pending-requests-card">
                    <div className="card-header">
                        <h2 className="card-title">Pending Leave Requests</h2>
                        <a href="/admin/leaves" className="view-all-link">View All</a>
                    </div>
                    <div className="requests-table">
                        <div className="table-header">
                            <span>Employee & Reason</span>
                            <span>Leave Date</span>
                            <span>Type</span>
                            <span>Actions</span>
                        </div>
                        <div className="requests-list">
                            {showSkeletons ? (
                                Array.from({ length: 4 }).map((_, idx) => (
                                    <div key={`pending-skel-${idx}`} className="request-item">
                                        <div className="request-info">
                                            <strong><Skeleton width="60%" /></strong>
                                            <span className="date"><Skeleton width="40%" /></span>
                                        </div>
                                        <div className="applied-date"><Skeleton width="60%" /></div>
                                        <div><Skeleton width="60%" /></div>
                                        <div className="request-actions" style={{ justifyContent: 'flex-end' }}>
                                            <Skeleton variant="rectangular" width={70} height={32} sx={{ borderRadius: 1 }} />
                                            <Skeleton variant="rectangular" width={70} height={32} sx={{ borderRadius: 1 }} />
                                        </div>
                                    </div>
                                ))
                            ) : pendingRequests.length > 0 ? (
                                pendingRequests.map(req => (
                                    <RequestItem 
                                        key={req._id} 
                                        request={req} 
                                        onStatusChange={handleRequestStatusChange} 
                                        onViewDetails={() => handleViewLeaveRequestDetails(req)}
                                    />
                                ))
                            ) : (
                                <div className="empty-state">No pending leave or work requests</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Middle Large Card: Who's In Today */}
                <div className="large-card whos-in-card">
                    <div className="card-header">
                        <h2 className="card-title">Who's In Today?</h2>
                    </div>
                    <div className="whos-in-list">
                        {showSkeletons ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <div key={`whos-skel-${idx}`} className="whos-in-item">
                                    <Avatar sx={{ bgcolor: 'var(--accent-teal)' }}>
                                        <Skeleton variant="circular" width={24} height={24} />
                                    </Avatar>
                                    <div className="item-details">
                                        <div className="name"><Skeleton width="50%" /></div>
                                        <div className="role"><Skeleton width="35%" /></div>
                                    </div>
                                    <div className="item-times">
                                        <div className="time-column">
                                            <div className="time-label">Log In</div>
                                            <div className="time-value"><Skeleton width={70} /></div>
                                        </div>
                                        <div className="time-column">
                                            <div className="time-label">Required Log Out</div>
                                            <div className="time-value logout-time"><Skeleton width={70} /></div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : summary?.whosInList?.length > 0 ? (
                            summary.whosInList.map(emp => (
                                <WhosInItem key={emp._id} employee={emp} />
                            ))
                        ) : (
                            <div className="empty-state">No employees are clocked in.</div>
                        )}
                    </div>
                </div>

                {/* Right Large Card: Recent Activity Feed & Quick Links */}
                <div className="large-card activity-card">
                    <div className="card-header">
                        <h2 className="card-title">Recent Activity & Quick Links</h2>
                    </div>
                    <div className="activity-section">
                        <div className="activity-subsection">
                            <h3 className="subsection-title">Recent Activity</h3>
                            <div className="activity-list">
                                {showSkeletons ? (
                                    Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={`activity-skel-${idx}`} className="activity-item">
                                            <Avatar sx={{ bgcolor: 'var(--accent-blue)', width: 32, height: 32 }}>
                                                <Skeleton variant="circular" width={20} height={20} />
                                            </Avatar>
                                            <div className="activity-details" style={{ flex: 1 }}>
                                                <div className="name"><Skeleton width="55%" /></div>
                                                <div className="activity-preview"><Skeleton width="80%" /></div>
                                            </div>
                                            <div className="activity-time"><Skeleton width={50} /></div>
                                        </div>
                                    ))
                                ) : filteredRecentActivity.length > 0 ? (
                                    filteredRecentActivity.slice(0, 4).map(item => (
                                        <ActivityItem key={item.type + item._id} item={item} onClick={() => handleOpenActivityModal(item)} />
                                    ))
                                ) : (
                                    <div className="empty-state-small">
                                        <NotesIcon/><p>No recent activity.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="quick-links-subsection">
                            <h3 className="subsection-title">Quick Links</h3>
                            <div className="quick-links-grid">
                                <a href="/employees" className="quick-link-item">
                                    <PeopleAltIcon />
                                    <span>Manage Employees</span>
                                </a>
                                <a href="/reports" className="quick-link-item">
                                    <WorkIcon />
                                    <span>View Reports</span>
                                </a>
                                <a href="/manage-section" className="quick-link-item">
                                    <AccessAlarmIcon />
                                    <span>Settings</span>
                                </a>
                                <a href="/admin/leaves" className="quick-link-item">
                                    <EventBusyIcon />
                                    <span>Leave Management</span>
                                </a>
                                <a 
                                    href="/admin/leaves" 
                                    className="quick-link-item"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        // Navigate to Employee Leave Count Summary tab
                                        window.location.href = '/admin/leaves?tab=leave-count';
                                    }}
                                >
                                    <AssessmentIcon />
                                    <span>Employee Leave Count</span>
                                </a>
                                <a 
                                    href="/admin/leaves" 
                                    className="quick-link-item"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        // Navigate to Intern Leave Count Summary tab
                                        window.location.href = '/admin/leaves?tab=intern-leave-count';
                                    }}
                                >
                                    <AssessmentIcon />
                                    <span>Intern Leave Count</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {selectedActivity && (
                <Dialog 
                    open={isActivityModalOpen} 
                    onClose={handleCloseActivityModal}
                    PaperProps={{ style: { borderRadius: 12, padding: '16px', minWidth: '400px' } }}
                >
                    <DialogTitle sx={{ fontWeight: 600, pb: 1, pt: 1 }}>
                        {selectedActivity.type === 'Note' ? 'Note from ' : 'Request from '} {selectedActivity.user.fullName}
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Employee Code: {selectedActivity.user.employeeCode} | Submitted: {new Date(selectedActivity.timestamp).toLocaleString()}
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 2, whiteSpace: 'pre-wrap', backgroundColor: '#f8f9fa', p: 2, borderRadius: 2 }}>
                            {selectedActivity.content}
                        </Typography>
                    </DialogContent>
                    
                    {(selectedActivity.type === 'ExtraBreakRequest' || selectedActivity.type === 'BackdatedLeaveRequest') && (
                        <DialogActions>
                            <Stack direction="row" spacing={2} sx={{width: '100%', justifyContent: 'flex-end'}}>
                                <Button onClick={() => handleActivityResponse(selectedActivity._id, 'Rejected', selectedActivity.type)} color="error" disabled={actionLoading}>Reject</Button>
                                <Button onClick={() => handleActivityResponse(selectedActivity._id, 'Approved', selectedActivity.type)} variant="contained" color="success" disabled={actionLoading}>
                                    {actionLoading ? <CircularProgress size={24} color="inherit" /> : 'Approve'}
                                </Button>
                            </Stack>
                        </DialogActions>
                    )}
                </Dialog>
            )}

            <Snackbar 
                open={snackbar.open} 
                autoHideDuration={4000} 
                onClose={() => setSnackbar({ ...snackbar, open: false })} 
                message={snackbar.message} 
            />

            <EmployeeListModal
                open={isEmployeeModalOpen}
                onClose={handleCloseEmployeeModal}
                cardType={selectedCardType}
                cardTitle={selectedCardTitle}
            />

            {/* Leave Request Details Modal */}
            <EnhancedLeaveRequestModal
                open={viewLeaveRequestDialog.open}
                onClose={handleCloseLeaveRequestDetails}
                request={viewLeaveRequestDialog.request}
                onStatusChange={async (requestId, status, rejectionNotes) => {
                    const originalRequests = [...pendingRequests];
                    setPendingRequests(prevRequests => prevRequests.filter(req => req._id !== requestId));
                    try {
                        await api.patch(`/admin/leaves/${requestId}/status`, { 
                            status,
                            ...(rejectionNotes && { rejectionNotes })
                        });
                        setSnackbar({ open: true, message: `Leave request has been ${status.toLowerCase()}.` });
                        if (fetchAllDataRef.current) {
                            await fetchAllDataRef.current(false);
                        }
                        // Modal will close itself after successful status change
                    } catch (err) {
                        setPendingRequests(originalRequests);
                        setError(err.response?.data?.error || 'Action failed. Please try again.');
                        throw err; // Re-throw so modal can handle the error state
                    }
                }}
                onEdit={(request) => {
                    handleCloseLeaveRequestDetails();
                    // Navigate to leaves page for editing
                    window.location.href = `/admin/leaves`;
                }}
                onDelete={(request) => {
                    handleCloseLeaveRequestDetails();
                    // Navigate to leaves page for deletion
                    window.location.href = `/admin/leaves`;
                }}
            />
        </div>
    );
};

export default AdminDashboardPage;