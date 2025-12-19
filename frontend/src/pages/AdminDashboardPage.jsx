// frontend/src/pages/AdminDashboardPage.jsx
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Alert, Avatar, Button, Tooltip, Snackbar, Chip, Dialog, DialogTitle, DialogContent, Typography, Box, DialogActions, Stack } from '@mui/material';
import {
    PeopleAlt as PeopleAltIcon,
    Work as WorkIcon,
    AccessAlarm as AccessAlarmIcon,
    EventBusy as EventBusyIcon,
    Link as LinkIcon,
    Notes as NotesIcon,
    MoreTime as MoreTimeIcon,
    HistoryEdu as HistoryEduIcon,
} from '@mui/icons-material';
import EmployeeListModal from '../components/EmployeeListModal';
import LeaveRejectionModal from '../components/LeaveRejectionModal';
import EnhancedLeaveRequestModal from '../components/EnhancedLeaveRequestModal';
import PageHeroHeader from '../components/PageHeroHeader';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import DashboardIcon from '@mui/icons-material/Dashboard';

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

const RequestItem = memo(({ request, onStatusChange, onRejectWithReason, onViewDetails }) => (
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
            <Button size="small" variant="outlined" color="error" onClick={() => onRejectWithReason(request)}>Reject</Button>
        </div>
    </div>
));

const WhosInItem = memo(({ employee }) => {
    const [liveLogoutTime, setLiveLogoutTime] = useState(null);
    const dataReceivedTimeRef = useRef(null);

    useEffect(() => {
        if (!employee.calculatedLogoutTime) {
            setLiveLogoutTime(null);
            dataReceivedTimeRef.current = null;
            return;
        }

        // Store when we received this data
        dataReceivedTimeRef.current = new Date();
        const baseLogoutTime = new Date(employee.calculatedLogoutTime);
        setLiveLogoutTime(baseLogoutTime);

        // If there's an active unpaid break, update logout time dynamically
        const hasActiveUnpaidBreak = employee.activeBreak && 
            (employee.activeBreak.breakType === 'Unpaid' || employee.activeBreak.breakType === 'Extra');

        if (hasActiveUnpaidBreak && employee.activeBreak.startTime) {
            const calculateLiveLogoutTime = () => {
                if (!dataReceivedTimeRef.current) return;
                
                const now = new Date();
                // Calculate how much time has passed since we received the data
                // The backend calculation included active break duration at that time
                // Each second that passes adds 1 second to the logout time (1:1 extension)
                const elapsedSinceDataReceived = now.getTime() - dataReceivedTimeRef.current.getTime();
                const newLiveLogoutTime = new Date(baseLogoutTime.getTime() + elapsedSinceDataReceived);
                setLiveLogoutTime(newLiveLogoutTime);
            };

            // Update every second to account for ongoing active break
            const timerId = setInterval(calculateLiveLogoutTime, 1000);
            return () => clearInterval(timerId);
        } else {
            // No active unpaid break, use static calculated time
            setLiveLogoutTime(baseLogoutTime);
            dataReceivedTimeRef.current = null;
        }
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
            <Avatar src={employee.profileImageUrl} sx={{ bgcolor: 'var(--accent-teal)' }}>
                {!employee.profileImageUrl && employee.fullName.charAt(0)}
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
    const { user } = useAuth();
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
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [selectedRequestForRejection, setSelectedRequestForRejection] = useState(null);
    const [rejectionLoading, setRejectionLoading] = useState(false);
    const [viewLeaveRequestDialog, setViewLeaveRequestDialog] = useState({ open: false, request: null });

    // =================================================================
    // ### START OF FIX ###
    // Guard against rendering the component if the user object hasn't been fetched yet.
    // This prevents the "Cannot read properties of undefined (reading 'name')" error.
    if (!user) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }
    // ### END OF FIX ###
    // =================================================================

    const fetchAllData = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) setLoading(true);
        setError('');
        try {
            const [summaryRes, requestsRes] = await Promise.all([
                api.get('/admin/dashboard-summary'),
                api.get('/admin/leaves/pending')
            ]);
            setSummary(summaryRes.data);
            // Sort pending requests by createdAt in descending order (latest first)
            const sortedRequests = Array.isArray(requestsRes.data) 
                ? [...requestsRes.data].sort((a, b) => {
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
    }, []);

    useEffect(() => {
        fetchAllData(true);
        const intervalId = setInterval(() => fetchAllData(false), 30000);
        
        // Force layout refresh to prevent CSS conflicts from other pages
        const forceLayoutRefresh = () => {
            // Trigger a reflow to ensure proper layout calculation
            document.body.offsetHeight;
            // Force browser to recalculate styles
            window.dispatchEvent(new Event('resize'));
        };
        
        // Run layout refresh after a short delay to ensure DOM is ready
        setTimeout(forceLayoutRefresh, 100);
        
        return () => clearInterval(intervalId);
    }, [fetchAllData]);

    // Additional useEffect to handle navigation back to dashboard
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // Page became visible (user navigated back), force layout refresh
                setTimeout(() => {
                    document.body.offsetHeight;
                    window.dispatchEvent(new Event('resize'));
                }, 50);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

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

    const handleRejectWithReason = (request) => {
        setSelectedRequestForRejection(request);
        setIsRejectionModalOpen(true);
    };

    const handleRejectionConfirm = async (rejectionReason) => {
        if (!selectedRequestForRejection) return;
        
        setRejectionLoading(true);
        const originalRequests = [...pendingRequests];
        setPendingRequests(prevRequests => prevRequests.filter(req => req._id !== selectedRequestForRejection._id));
        
        try {
            await api.patch(`/admin/leaves/${selectedRequestForRejection._id}/status`, { 
                status: 'Rejected',
                rejectionNotes: rejectionReason
            });
            setSnackbar({ open: true, message: 'Leave request has been rejected with reason.' });
            setIsRejectionModalOpen(false);
            setSelectedRequestForRejection(null);
        } catch (err) {
            setPendingRequests(originalRequests);
            setError(err.response?.data?.error || 'Failed to reject leave request. Please try again.');
        } finally {
            setRejectionLoading(false);
        }
    };

    const handleCloseRejectionModal = () => {
        setIsRejectionModalOpen(false);
        setSelectedRequestForRejection(null);
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
            await fetchAllData(); // Refresh data
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

    const handleCardClick = (cardType, cardTitle) => {
        setSelectedCardType(cardType);
        setSelectedCardTitle(cardTitle);
        setIsEmployeeModalOpen(true);
    };

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
    ), [summary]);

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


    if (loading) return <div className="empty-state" style={{ height: '80vh' }}><CircularProgress /></div>;

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
                {summaryCardsData.map((card, index) => (
                    <SummaryCard key={card.key || index} {...card} />
                ))}
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
                            {pendingRequests.length > 0 ? (
                                pendingRequests.map(req => (
                                    <RequestItem 
                                        key={req._id} 
                                        request={req} 
                                        onStatusChange={handleRequestStatusChange} 
                                        onRejectWithReason={handleRejectWithReason}
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
                        {summary?.whosInList?.length > 0 ? (
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
                                {filteredRecentActivity.length > 0 ? (
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

            <LeaveRejectionModal
                open={isRejectionModalOpen}
                onClose={handleCloseRejectionModal}
                onConfirm={handleRejectionConfirm}
                request={selectedRequestForRejection}
                loading={rejectionLoading}
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
                        await fetchAllData();
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