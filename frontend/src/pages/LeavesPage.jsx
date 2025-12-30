// src/pages/LeavesPage.jsx
import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { Typography, Button, CircularProgress, Alert, Chip, Box, Snackbar, Paper, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions, Grid, IconButton, TextField, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Menu, MenuItem, ListItemIcon, ListItemText, Skeleton } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FestivalIcon from '@mui/icons-material/Festival';
import TempleHinduIcon from '@mui/icons-material/TempleHindu';
import MosqueIcon from '@mui/icons-material/Mosque';
import ChurchIcon from '@mui/icons-material/Church';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SickIcon from '@mui/icons-material/Sick';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import InfoIcon from '@mui/icons-material/Info';
import DateRangeIcon from '@mui/icons-material/DateRange';
import DescriptionIcon from '@mui/icons-material/Description';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import CloseIcon from '@mui/icons-material/Close';
import ForwardIcon from '@mui/icons-material/Forward';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LeaveRequestForm from '../components/LeaveRequestForm';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import '../styles/LeavesPage.css';
import { CardSkeleton, TableSkeleton } from '../components/SkeletonLoaders';

// Reusable component for the small rounded balance boxes
const BalanceBox = ({ title, balance, icon }) => (
    <Paper elevation={3} className="balance-box">
        <Box className="balance-icon-wrapper">
            {icon}
        </Box>
        <Typography className="balance-value">{balance}</Typography>
        <Typography className="balance-title">{title}</Typography>
    </Paper>
);

// Reusable component for the large rectangular content cards
const ContentCard = ({ title, children }) => (
    <Paper elevation={3} className="content-card">
        <Typography variant="h6" className="content-card-title">{title}</Typography>
        <Box className="scrollable-content">
            {children}
        </Box>
    </Paper>
);

const LeavesPage = () => {
    const { user } = useAuth();
    const [myRequests, setMyRequests] = useState([]);
    const [leaveBalances, setLeaveBalances] = useState({ paid: 0, sick: 0, casual: 0 });
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    
    // Pagination state
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    
    // Modal state for leave details
    const [viewDialog, setViewDialog] = useState({ open: false, request: null });
    
    // Carryforward state
    const [carryforwardStatus, setCarryforwardStatus] = useState(null);
    const [carryforwardModalOpen, setCarryforwardModalOpen] = useState(false);
    const [carryforwardDecision, setCarryforwardDecision] = useState('Carry Forward');
    const [carryforwardAmounts, setCarryforwardAmounts] = useState({ sick: 0, casual: 0, paid: 0 });
    const [processingCarryforward, setProcessingCarryforward] = useState(false);
    
    // Year-end actions state
    const [yearEndModalOpen, setYearEndModalOpen] = useState(false);
    const [yearEndMenuAnchor, setYearEndMenuAnchor] = useState(null);
    const [yearEndSelections, setYearEndSelections] = useState({}); // { leaveType: { subType, days } }
    const [processingYearEnd, setProcessingYearEnd] = useState(false);
    const [yearEndFeatureEnabled, setYearEndFeatureEnabled] = useState(false);

    // Map UI leave types to balances (fallback to 0)
    const getYearEndBalanceForType = useCallback((leaveType) => {
        const key = leaveType?.toLowerCase();
        if (key === 'sick') return leaveBalances.sick ?? 0;
        if (key === 'casual') return leaveBalances.casual ?? 0;
        if (key === 'planned') return leaveBalances.paid ?? 0;
        return 0;
    }, [leaveBalances]);

    // Summary of remaining balances for quick scanning in the year-end modal (uses live balances)
    const yearEndBalanceSummary = useMemo(() => {
        return {
            Sick: getYearEndBalanceForType('Sick'),
            Casual: getYearEndBalanceForType('Casual'),
            Planned: getYearEndBalanceForType('Planned'),
        };
    }, [getYearEndBalanceForType]);
    

    const fetchPageData = useCallback(async () => {
        setLoading(true);
        try {
            const [requestsRes, balancesRes, holidaysRes, carryforwardRes, featureStatusRes] = await Promise.all([
                api.get(`/leaves/my-requests?page=${page + 1}&limit=${rowsPerPage}`),
                api.get('/leaves/my-leave-balances'),
                api.get('/leaves/holidays'),
                api.get('/leaves/carryforward-status').catch(() => ({ data: { hasPendingDecision: false } })),
                api.get('/leaves/year-end-feature-status').catch(() => ({ data: { enabled: false } }))
            ]);
            
            // Handle paginated response for requests
            if (requestsRes.data.requests) {
                setMyRequests(Array.isArray(requestsRes.data.requests) ? requestsRes.data.requests : []);
                setTotalCount(requestsRes.data.totalCount || 0);
            } else {
                setMyRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
            }
            
            setLeaveBalances(balancesRes.data);
            // Sort holidays: valid dates first (ASC), then tentative at bottom (alphabetically)
            const holidaysData = Array.isArray(holidaysRes.data) ? holidaysRes.data : [];
            const sortedHolidays = holidaysData.sort((a, b) => {
                const aIsTentative = !a.date || a.isTentative;
                const bIsTentative = !b.date || b.isTentative;
                
                // If both are tentative, sort alphabetically by name
                if (aIsTentative && bIsTentative) {
                    return a.name.localeCompare(b.name);
                }
                // If only a is tentative, put it at bottom
                if (aIsTentative) return 1;
                // If only b is tentative, put it at bottom
                if (bIsTentative) return -1;
                // Both have dates, sort by date
                return new Date(a.date) - new Date(b.date);
            });
            setHolidays(sortedHolidays);
            setCarryforwardStatus(carryforwardRes.data);
            // Year-end feature is enabled only if feature is enabled AND user is permanent
            setYearEndFeatureEnabled(featureStatusRes.data?.enabled || false);
        } catch (err) {
            setError('Failed to load leave management data.');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage]);
    
    // Get existing Year-End requests for current year
    const getExistingYearEndRequest = useCallback((leaveType) => {
        const currentYear = new Date().getFullYear();
        return myRequests.find(req => 
            req.requestType === 'YEAR_END' && 
            req.yearEndLeaveType === leaveType && 
            req.yearEndYear === currentYear &&
            (req.status === 'Pending' || req.status === 'Approved')
        );
    }, [myRequests]);

    useEffect(() => { fetchPageData(); }, [fetchPageData]);
    
    // Smart refresh strategy: Refresh when page becomes visible and periodically while visible
    useEffect(() => {
        let refreshInterval = null;
        const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes when page is visible
        let wasHidden = false;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Page became hidden - clear the refresh interval
                wasHidden = true;
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                    refreshInterval = null;
                }
            } else {
                // Page became visible - refresh data immediately and start interval
                if (wasHidden) {
            fetchPageData();
                    wasHidden = false;
                }
                
                // Start periodic refresh while page is visible
                if (!refreshInterval) {
                    refreshInterval = setInterval(() => {
                        // Only refresh if page is still visible
                        if (!document.hidden) {
                            fetchPageData();
                        }
                    }, REFRESH_INTERVAL);
                }
            }
        };

        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Start the interval if page is currently visible
        if (!document.hidden) {
            refreshInterval = setInterval(() => {
                if (!document.hidden) {
                    fetchPageData();
                }
            }, REFRESH_INTERVAL);
        }

        // Cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };
    }, [fetchPageData]);

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const handleRequestSubmitted = useCallback((newRequest) => {
        handleCloseModal();
        setSnackbar({ open: true, message: 'Your request has been submitted successfully!' });
        fetchPageData();
    }, [fetchPageData]);
    
    const handlePageChange = (event, newPage) => {
        setPage(newPage);
    };
    
    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    
    const handleViewDetails = (request) => {
        setViewDialog({ open: true, request });
    };
    
    const handleOpenCarryforwardModal = async () => {
        try {
            const res = await api.get('/leaves/previous-year-balances');
            if (res.data.hasRemainingLeaves && !res.data.decisionMade) {
                setCarryforwardStatus(res.data);
                setCarryforwardAmounts({
                    sick: res.data.previousYearBalances.sick || 0,
                    casual: res.data.previousYearBalances.casual || 0,
                    paid: res.data.previousYearBalances.paid || 0
                });
                setCarryforwardModalOpen(true);
            } else if (res.data.decisionMade) {
                setSnackbar({ open: true, message: `You have already chosen ${res.data.decision} for previous year leaves.`, severity: 'info' });
            } else {
                setSnackbar({ open: true, message: 'No remaining leaves from previous year.', severity: 'info' });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to load previous year balances.', severity: 'error' });
        }
    };
    
    const handleCloseCarryforwardModal = () => {
        setCarryforwardModalOpen(false);
        setCarryforwardDecision('Carry Forward');
        setCarryforwardAmounts({ sick: 0, casual: 0, paid: 0 });
    };
    
    const handleSubmitCarryforwardDecision = async () => {
        setProcessingCarryforward(true);
        try {
            const payload = {
                decision: carryforwardDecision
            };
            
            if (carryforwardDecision === 'Carry Forward') {
                payload.carryforwardAmounts = carryforwardAmounts;
            }
            
            await api.post('/leaves/carryforward-decision', payload);
            setSnackbar({ open: true, message: 'Decision submitted successfully!', severity: 'success' });
            handleCloseCarryforwardModal();
            fetchPageData();
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to submit decision.', severity: 'error' });
        } finally {
            setProcessingCarryforward(false);
        }
    };
    
    const handleYearEndSelection = (leaveType, subType) => {
        setYearEndSelections(prev => ({
            ...prev,
            [leaveType]: {
                ...prev[leaveType],
                subType
            }
        }));
    };
    
    const handleSubmitYearEndRequests = async () => {
        // Check if feature is enabled
        if (!yearEndFeatureEnabled) {
            setSnackbar({ open: true, message: 'Year-End Leave actions are currently disabled by Admin.', severity: 'warning' });
            return;
        }

        // CRITICAL: Check for existing requests before submission
        const currentYear = new Date().getFullYear();
        const existingRequests = [];
        
        Object.keys(yearEndSelections).forEach(leaveType => {
            const existing = getExistingYearEndRequest(leaveType);
            if (existing && (existing.status === 'Pending' || existing.status === 'Approved')) {
                existingRequests.push({ leaveType, status: existing.status });
            }
        });

        if (existingRequests.length > 0) {
            const leaveTypes = existingRequests.map(r => r.leaveType).join(', ');
            setSnackbar({ 
                open: true, 
                message: `Cannot submit: Year-End request already exists for ${leaveTypes} leave type(s).`, 
                severity: 'error' 
            });
            return;
        }

        // Validate selections
        const selections = Object.entries(yearEndSelections).filter(([leaveType, selection]) => {
            const existing = getExistingYearEndRequest(leaveType);
            return !existing && selection && selection.subType && getYearEndBalanceForType(leaveType) > 0;
        });

        if (selections.length === 0) {
            setSnackbar({ open: true, message: 'Please select at least one Year-End action.', severity: 'warning' });
            return;
        }

        setProcessingYearEnd(true);
        try {
            // Submit each Year-End request
            const promises = selections.map(([leaveType, selection]) => {
                const days = getYearEndBalanceForType(leaveType);
                return api.post('/leaves/year-end-request', {
                    leaveType,
                    subType: selection.subType,
                    days
                });
            });

            await Promise.all(promises);
            setSnackbar({ open: true, message: 'Your Year-End leave request(s) have been submitted successfully!', severity: 'success' });
            setYearEndModalOpen(false);
            setYearEndSelections({});
            fetchPageData();
        } catch (err) {
            // Handle 409 conflict (duplicate request)
            if (err.response?.status === 409) {
                setSnackbar({ 
                    open: true, 
                    message: err.response?.data?.error || 'Year-End request already exists for this leave type.', 
                    severity: 'warning' 
                });
                // Refresh data to show existing request
                fetchPageData();
            } else {
                setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to submit Year-End request(s).', severity: 'error' });
            }
        } finally {
            setProcessingYearEnd(false);
        }
    };

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    const formatPrettyDate = (dateString, isTentative = false) => {
        if (!dateString || isTentative) {
            return 'Tentative (Date not decided)';
        }
        const d = new Date(dateString);
        if (isNaN(d.getTime())) {
            return 'Tentative (Date not decided)';
        }
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };

    const statusStyles = {
        Approved: 'status-chip-approved',
        Rejected: 'status-chip-rejected',
        Pending: 'status-chip-pending',
    };

    // Holiday icon chooser based on type/category/name
    const holidayIconFor = (holiday) => {
        const key = String(holiday?.type || holiday?.category || holiday?.name || '').toLowerCase();
        if (key.includes('diwali') || key.includes('navratri') || key.includes('hindu')) return <TempleHinduIcon />;
        if (key.includes('eid') || key.includes('ramzan') || key.includes('islam')) return <MosqueIcon />;
        if (key.includes('christmas') || key.includes('good friday') || key.includes('church')) return <ChurchIcon />;
        if (key.includes('new year') || key.includes('celebration')) return <CelebrationIcon />;
        if (key.includes('festival')) return <FestivalIcon />;
        return <EventIcon />;
    };

    // Helpers mirroring SaturdaySchedule.jsx logic
    const getNthDayOfMonth = (date, dayOfWeek, n) => {
        const newDate = new Date(date.getTime());
        newDate.setDate(1);
        const firstDay = newDate.getDay();
        let day = dayOfWeek - firstDay + 1;
        if (day <= 0) day += 7;
        const nthDate = day + (n - 1) * 7;
        const lastDay = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
        if (nthDate > lastDay) return null;
        newDate.setDate(nthDate);
        return newDate;
    };

    const saturdaySchedule = useMemo(() => {
        const approvedRequestsMap = new Map();
        if (myRequests) {
            myRequests.forEach(req => {
                if (req.status === 'Approved' && req.leaveDates && req.leaveDates[0]) {
                    // Fix: Use the date directly if it's already in YYYY-MM-DD format
                    // to avoid timezone conversion issues
                    const dateKey = typeof req.leaveDates[0] === 'string' && req.leaveDates[0].includes('-') 
                        ? req.leaveDates[0] 
                        : new Date(req.leaveDates[0]).toISOString().split('T')[0];
                    approvedRequestsMap.set(dateKey, req);
                }
            });
        }
        const schedule = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let monthOffset = 0;
        const count = 6;
        const policy = user?.alternateSaturdayPolicy;
        while (schedule.length < count) {
            const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
            for (let n = 1; n <= 5; n++) {
                const sat = getNthDayOfMonth(targetDate, 6, n);
                if (sat && sat >= today && schedule.length < count) {
                    const dateString = sat.toISOString().split('T')[0];
                    const weekNum = n;
                    let finalStatus;
                    const approvedRequest = approvedRequestsMap.get(dateString);
                    if (approvedRequest) {
                        finalStatus = `${formatLeaveRequestType(approvedRequest.requestType) || 'Leave'} Approved`;
                    } else {
                        let isWorkingDay = true;
                        if (policy === 'All Saturdays Off') {
                            isWorkingDay = false;
                        } else if (policy === 'Week 1 & 3 Off' && (weekNum === 1 || weekNum === 3)) {
                            isWorkingDay = false;
                        } else if (policy === 'Week 2 & 4 Off' && (weekNum === 2 || weekNum === 4)) {
                            isWorkingDay = false;
                        }
                        finalStatus = isWorkingDay ? 'Working' : 'Off';
                    }
                    schedule.push({ date: sat, status: finalStatus });
                }
            }
            monthOffset++;
            if (monthOffset > 12) break;
        }
        return schedule;
    }, [user?.alternateSaturdayPolicy, myRequests]);

    if (loading) {
        return (
            <div className="leaves-page-redesigned">
                <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {[1, 2, 3].map((i) => (
                        <Paper key={i} elevation={3} sx={{ p: 3, flex: '1 1 200px', minWidth: 200, maxWidth: 300 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1 }} />
                                <Skeleton variant="text" width={60} height={32} sx={{ mb: 0.5 }} />
                                <Skeleton variant="text" width={100} height={20} />
                            </Box>
                        </Paper>
                    ))}
                </Box>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Paper elevation={3} sx={{ p: 2 }}>
                            <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
                            <TableSkeleton rows={5} columns={5} minHeight="400px" />
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <CardSkeleton count={2} minHeight="400px" />
                    </Grid>
                </Grid>
            </div>
        );
    }

    return (
        <div className="leaves-page-redesigned">
            {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}

            {/* Header Bar */}
            <Box className="leaves-header-bar">
                <Box className="header-title-wrapper">
                    <CalendarTodayIcon className="header-icon" />
                    <Typography variant="h6" className="page-title">Leave Management</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button className="apply-leave-button" onClick={handleOpenModal} startIcon={<AddCircleOutlineIcon />}>
                        Apply Leave
                    </Button>
                    {yearEndFeatureEnabled && user?.employmentStatus === 'Permanent' && (
                        <IconButton
                            onClick={(e) => {
                                setYearEndMenuAnchor(e.currentTarget);
                            }}
                            sx={{
                                color: 'white',
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                                cursor: 'pointer'
                            }}
                            title="Year-End Leave Options"
                        >
                            <MoreVertIcon />
                        </IconButton>
                    )}
                </Box>
            </Box>
            
            {/* Year-End Menu */}
            <Menu
                anchorEl={yearEndMenuAnchor}
                open={Boolean(yearEndMenuAnchor)}
                onClose={() => setYearEndMenuAnchor(null)}
            >
                <MenuItem 
                    onClick={() => {
                        setYearEndMenuAnchor(null);
                        setYearEndModalOpen(true);
                    }}
                    disabled={!yearEndFeatureEnabled}
                >
                    <ListItemIcon>
                        <ForwardIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                        primary="Year-End Leave Options"
                        secondary={!yearEndFeatureEnabled ? "Currently disabled by Admin" : ""}
                    />
                </MenuItem>
            </Menu>

            {/* Balance Boxes - Small Rounded Boxes */}
            <Box className="balance-grid">
                <BalanceBox 
                    title="Sick Leave" 
                    balance={leaveBalances.sick} 
                    icon={<SickIcon className="balance-icon" />}
                />
                <BalanceBox 
                    title="Casual Leave" 
                    balance={leaveBalances.casual} 
                    icon={<WorkOutlineIcon className="balance-icon" />}
                />
                <BalanceBox 
                    title="Planned Leave" 
                    balance={leaveBalances.paid} 
                    icon={<BeachAccessIcon className="balance-icon" />}
                />
            </Box>

            {/* Carryforward/Encashment Section */}
            {carryforwardStatus && carryforwardStatus.hasPendingDecision && (
                <Paper 
                    elevation={3} 
                    sx={{ 
                        p: 3, 
                        mb: 3, 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        borderRadius: '12px'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <ForwardIcon sx={{ fontSize: 32 }} />
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    Previous Year Leave Balance Available
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                    You have remaining leaves from {carryforwardStatus.year || new Date().getFullYear() - 1}. 
                                    Choose to carry forward or encash them.
                                </Typography>
                                {carryforwardStatus.previousYearBalances && (
                                    <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                        {carryforwardStatus.previousYearBalances.sick > 0 && (
                                            <Chip 
                                                label={`Sick: ${carryforwardStatus.previousYearBalances.sick} days`} 
                                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                            />
                                        )}
                                        {carryforwardStatus.previousYearBalances.casual > 0 && (
                                            <Chip 
                                                label={`Casual: ${carryforwardStatus.previousYearBalances.casual} days`} 
                                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                            />
                                        )}
                                        {carryforwardStatus.previousYearBalances.paid > 0 && (
                                            <Chip 
                                                label={`Planned: ${carryforwardStatus.previousYearBalances.paid} days`} 
                                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                                            />
                                        )}
                                    </Box>
                                )}
                            </Box>
                        </Box>
                        <Button
                            variant="contained"
                            onClick={handleOpenCarryforwardModal}
                            startIcon={<ForwardIcon />}
                            sx={{
                                bgcolor: 'white',
                                color: '#667eea',
                                '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.9)',
                                },
                                fontWeight: 600,
                                px: 3,
                                py: 1.5
                            }}
                        >
                            Choose Option
                        </Button>
                    </Box>
                </Paper>
            )}

            {/* Content Grid - 3 Large Rectangles */}
            <Box className="content-grid">
                <ContentCard title="Application Requests">
                    {myRequests.length === 0 ? (
                        <Box className="empty-state">
                            <CalendarTodayIcon className="empty-state-icon" />
                            <Typography variant="h6" className="empty-state-title">No Leave Requests</Typography>
                            <Typography variant="body2" className="empty-state-subtitle">
                                You haven't submitted any leave requests yet. Click "Apply Leave" to get started.
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <TableContainer className="table-container">
                                <Table stickyHeader aria-label="leave requests table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>S.No</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Request Type</TableCell>
                                            <TableCell>Leave Type</TableCell>
                                            <TableCell>Date(s)</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {myRequests.map((row, index) => (
                                            <TableRow 
                                                key={row._id} 
                                                hover 
                                                onClick={() => handleViewDetails(row)}
                                                className="table-row-clickable"
                                            >
                                                <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                                                <TableCell>
                                                    <Chip label={row.status} className={`status-chip ${statusStyles[row.status] || ''}`} />
                                                </TableCell>
                                                <TableCell>{formatLeaveRequestType(row.requestType)}</TableCell>
                                                <TableCell>{row.leaveType}</TableCell>
                                                <TableCell>
                                                    {row.requestType === 'Compensatory' && row.alternateDate ? (
                                                        <Box>
                                                            <Typography variant="body2" component="div"><strong>Leave:</strong> {formatDate(row.leaveDates[0])}</Typography>
                                                            <Typography variant="caption" color="textSecondary"><strong>Work:</strong> {formatDate(row.alternateDate)}</Typography>
                                                        </Box>
                                                    ) : (
                                                        row.leaveDates.map(formatDate).join(', ')
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            
                            <TablePagination
                                rowsPerPageOptions={[5, 10, 25, 50]}
                                component="div"
                                count={totalCount}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                onPageChange={handlePageChange}
                                onRowsPerPageChange={handleRowsPerPageChange}
                                className="table-pagination"
                            />
                        </>
                    )}
                </ContentCard>

                <ContentCard title="Company Holidays">
                    <ul className="vector-list">
                        {holidays && holidays.length > 0 ? (
                            holidays.map((holiday, idx) => {
                                const isTentative = !holiday.date || holiday.isTentative;
                                return (
                                    <li key={holiday._id || idx} className="vector-item">
                                        <span className="vector-icon" aria-hidden="true">
                                            {holidayIconFor(holiday)}
                                        </span>
                                        <span className="vector-text">
                                            <span className="vector-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {holiday.name}
                                                {isTentative && (
                                                    <Chip 
                                                        label="Tentative" 
                                                        size="small" 
                                                        color="warning"
                                                        sx={{ height: '20px', fontSize: '0.7rem' }}
                                                    />
                                                )}
                                            </span>
                                            <span className="vector-subtitle">
                                                {formatPrettyDate(holiday.date, isTentative)}
                                            </span>
                                        </span>
                                    </li>
                                );
                            })
                        ) : (
                            <li className="vector-item" style={{ justifyContent: 'center' }}>
                                <span className="vector-text">
                                    <span className="vector-title">No holidays scheduled</span>
                                </span>
                            </li>
                        )}
                    </ul>
                </ContentCard>

                <ContentCard title="Saturday Schedule">
                    {saturdaySchedule.length === 0 ? (
                        <Box className="empty-state">
                            <AccessTimeIcon className="empty-state-icon" />
                            <Typography variant="h6" className="empty-state-title">No Schedule Available</Typography>
                            <Typography variant="body2" className="empty-state-subtitle">
                                Saturday schedule information will appear here.
                            </Typography>
                        </Box>
                    ) : (
                        <ul className="vector-list">
                            {saturdaySchedule.map(({ date, status }, idx) => {
                                const isWorking = status === 'Working';
                                const isLeave = status.includes('Approved');
                                const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                return (
                                    <li key={`${date.toISOString()}-${idx}`} className="vector-item">
                                        <span className="vector-icon" aria-hidden="true">
                                            <AccessTimeIcon />
                                        </span>
                                        <span className="vector-text">
                                            <span className="vector-title">{dayLabel}</span>
                                            <span className="vector-subtitle">{isLeave ? status : (isWorking ? 'Working Day' : 'Holiday')}</span>
                                        </span>
                                        <span className={`badge ${isLeave ? 'off' : (isWorking ? 'working' : 'off')}`}>{isLeave ? 'On Leave' : (isWorking ? 'Working' : 'Off')}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </ContentCard>
            </Box>

            {/* Keep form mounted; visibility controlled by open state */}
            <LeaveRequestForm
                open={isModalOpen}
                onClose={handleCloseModal}
                onSubmissionSuccess={handleRequestSubmitted}
            />

            {/* Leave Details Modal */}
            <Dialog 
                open={viewDialog.open} 
                onClose={() => setViewDialog({ open: false, request: null })} 
                maxWidth="md" 
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '20px',
                        overflow: 'hidden',
                        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15)',
                        border: '1px solid rgba(0, 0, 0, 0.05)'
                    }
                }}
            >
                <Box className="leave-details-modal-header">
                    <Box className="leave-details-header-content">
                        <CalendarTodayIcon className="leave-details-header-icon" />
                        <Typography variant="h5" className="leave-details-title">Leave Request Details</Typography>
                    </Box>
                    <IconButton 
                        onClick={() => setViewDialog({ open: false, request: null })}
                        className="leave-details-close-button"
                        size="small"
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
                
                <DialogContent className="leave-details-content">
                    {viewDialog.request && (
                        <Box>
                            {/* Status Banner */}
                            <Paper 
                                elevation={0} 
                                className={`leave-details-status-banner ${viewDialog.request.status.toLowerCase()}`}
                            >
                                <Box className="status-banner-content">
                                    {viewDialog.request.status === 'Approved' && <CheckCircleIcon className="status-icon" />}
                                    {viewDialog.request.status === 'Rejected' && <CancelIcon className="status-icon" />}
                                    {viewDialog.request.status === 'Pending' && <PendingIcon className="status-icon" />}
                                    <Box>
                                        <Typography variant="caption" className="status-banner-label">Status</Typography>
                                        <Typography variant="h6" className="status-banner-value">
                                            {viewDialog.request.status}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>

                            <Box sx={{ my: 3, height: '1px', background: 'linear-gradient(90deg, transparent, #e0e0e0, transparent)' }} />

                            {/* Request Information Grid */}
                            <Grid container spacing={3}>
                                <Grid item xs={12} sm={6}>
                                    <Box className="detail-field">
                                        <Box className="detail-field-header">
                                            <InfoIcon className="detail-field-icon" />
                                            <Typography variant="subtitle2" className="detail-field-label">Request Type</Typography>
                                        </Box>
                                        <Paper elevation={0} className="detail-field-value">
                                            <Typography variant="body1" className="detail-field-text">
                                                {formatLeaveRequestType(viewDialog.request.requestType)}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Box className="detail-field">
                                        <Box className="detail-field-header">
                                            <WorkOutlineIcon className="detail-field-icon" />
                                            <Typography variant="subtitle2" className="detail-field-label">Leave Type</Typography>
                                        </Box>
                                        <Paper elevation={0} className="detail-field-value">
                                            <Typography variant="body1" className="detail-field-text">
                                                {viewDialog.request.leaveType}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Box className="detail-field">
                                        <Box className="detail-field-header">
                                            <CalendarTodayIcon className="detail-field-icon" />
                                            <Typography variant="subtitle2" className="detail-field-label">Submitted Date</Typography>
                                        </Box>
                                        <Paper elevation={0} className="detail-field-value">
                                            <Typography variant="body1" className="detail-field-text">
                                                {formatPrettyDate(viewDialog.request.createdAt)}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Box className="detail-field">
                                        <Box className="detail-field-header">
                                            <AccessTimeIcon className="detail-field-icon" />
                                            <Typography variant="subtitle2" className="detail-field-label">Total Days</Typography>
                                        </Box>
                                        <Paper elevation={0} className="detail-field-value">
                                            <Typography variant="body1" className="detail-field-text">
                                                {viewDialog.request.leaveDates?.length || 0} day{viewDialog.request.leaveDates?.length !== 1 ? 's' : ''}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                </Grid>

                                <Grid item xs={12}>
                                    <Box className="detail-field">
                                        <Box className="detail-field-header">
                                            <DateRangeIcon className="detail-field-icon" />
                                            <Typography variant="subtitle2" className="detail-field-label">Date(s)</Typography>
                                        </Box>
                                        <Paper elevation={0} className="detail-field-value dates-field">
                                            {viewDialog.request.requestType === 'Compensatory' && viewDialog.request.alternateDate ? (
                                                <Box>
                                                    <Box className="date-item">
                                                        <Typography variant="body2" className="date-label">Leave Date:</Typography>
                                                        <Typography variant="body1" className="date-value">
                                                            {formatPrettyDate(viewDialog.request.leaveDates[0])}
                                                        </Typography>
                                                    </Box>
                                                    <Box className="date-item" sx={{ mt: 1.5 }}>
                                                        <Typography variant="body2" className="date-label">Alternate Work Date:</Typography>
                                                        <Typography variant="body1" className="date-value">
                                                            {formatPrettyDate(viewDialog.request.alternateDate)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            ) : (
                                                <Box className="dates-list">
                                                    {viewDialog.request.leaveDates.map((date, idx) => (
                                                        <Chip
                                                            key={idx}
                                                            label={formatPrettyDate(date)}
                                                            className="date-chip"
                                                            size="small"
                                                        />
                                                    ))}
                                                </Box>
                                            )}
                                        </Paper>
                                    </Box>
                                </Grid>

                                <Grid item xs={12}>
                                    <Box className="detail-field">
                                        <Box className="detail-field-header">
                                            <DescriptionIcon className="detail-field-icon" />
                                            <Typography variant="subtitle2" className="detail-field-label">Reason</Typography>
                                        </Box>
                                        <Paper elevation={0} className="detail-field-value reason-field">
                                            <Typography variant="body1" className="reason-text">
                                                {viewDialog.request.reason || 'No reason provided'}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                </Grid>

                                {viewDialog.request.rejectionNotes && (
                                    <Grid item xs={12}>
                                        <Box className="detail-field">
                                            <Box className="detail-field-header">
                                                <CancelIcon className="detail-field-icon rejection-icon" />
                                                <Typography variant="subtitle2" className="detail-field-label">Rejection Notes</Typography>
                                            </Box>
                                            <Paper elevation={0} className="detail-field-value rejection-notes-field">
                                                <Typography variant="body1" className="rejection-text">
                                                    {viewDialog.request.rejectionNotes}
                                                </Typography>
                                            </Paper>
                                        </Box>
                                    </Grid>
                                )}
                            </Grid>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions className="leave-details-actions">
                    <Button 
                        onClick={() => setViewDialog({ open: false, request: null })}
                        variant="contained"
                        className="leave-details-close-btn"
                        startIcon={<CloseIcon />}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Carryforward/Encashment Modal */}
            <Dialog 
                open={carryforwardModalOpen} 
                onClose={handleCloseCarryforwardModal}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '20px',
                        overflow: 'hidden',
                        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15)',
                    }
                }}
            >
                <DialogTitle sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    pb: 2
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <ForwardIcon />
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            Leave Carryforward / Encashment
                        </Typography>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    {carryforwardStatus && carryforwardStatus.previousYearBalances && (
                        <>
                            <Alert severity="info" sx={{ mb: 3 }}>
                                You have remaining leaves from {carryforwardStatus.year || new Date().getFullYear() - 1}. 
                                Choose whether to carry them forward to the current year or encash them.
                            </Alert>
                            
                            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                                    Previous Year Remaining Balances:
                                </Typography>
                                <Grid container spacing={2}>
                                    {carryforwardStatus.previousYearBalances.sick > 0 && (
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'white', borderRadius: 1 }}>
                                                <SickIcon sx={{ color: '#d32f2f', mb: 0.5 }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    {carryforwardStatus.previousYearBalances.sick}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Sick Leave
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    )}
                                    {carryforwardStatus.previousYearBalances.casual > 0 && (
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'white', borderRadius: 1 }}>
                                                <WorkOutlineIcon sx={{ color: '#1976d2', mb: 0.5 }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    {carryforwardStatus.previousYearBalances.casual}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Casual Leave
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    )}
                                    {carryforwardStatus.previousYearBalances.paid > 0 && (
                                        <Grid item xs={12} sm={4}>
                                            <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'white', borderRadius: 1 }}>
                                                <BeachAccessIcon sx={{ color: '#2e7d32', mb: 0.5 }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                    {carryforwardStatus.previousYearBalances.paid}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Planned Leave
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    )}
                                </Grid>
                            </Paper>

                            <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
                                <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                                    Choose Your Option:
                                </FormLabel>
                                <RadioGroup
                                    value={carryforwardDecision}
                                    onChange={(e) => setCarryforwardDecision(e.target.value)}
                                >
                                    <FormControlLabel 
                                        value="Carry Forward" 
                                        control={<Radio />} 
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <ForwardIcon sx={{ color: '#1976d2' }} />
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                        Carry Forward
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Add remaining leaves to your current year balance (type-specific)
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        }
                                        sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}
                                    />
                                    <FormControlLabel 
                                        value="Encashment" 
                                        control={<Radio />} 
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <AttachMoneyIcon sx={{ color: '#2e7d32' }} />
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                        Encashment
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Cash out all remaining leaves
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        }
                                        sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}
                                    />
                                </RadioGroup>
                            </FormControl>

                            {carryforwardDecision === 'Carry Forward' && (
                                <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2, mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                                        Select Amount to Carry Forward (Leave type-specific):
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {carryforwardStatus.previousYearBalances.sick > 0 && (
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    label="Sick Leave"
                                                    type="number"
                                                    fullWidth
                                                    size="small"
                                                    value={carryforwardAmounts.sick}
                                                    onChange={(e) => {
                                                        const val = Math.max(0, Math.min(
                                                            parseFloat(e.target.value) || 0,
                                                            carryforwardStatus.previousYearBalances.sick
                                                        ));
                                                        setCarryforwardAmounts(prev => ({ ...prev, sick: val }));
                                                    }}
                                                    inputProps={{ 
                                                        min: 0, 
                                                        max: carryforwardStatus.previousYearBalances.sick,
                                                        step: 0.5
                                                    }}
                                                    helperText={`Max: ${carryforwardStatus.previousYearBalances.sick} days`}
                                                />
                                            </Grid>
                                        )}
                                        {carryforwardStatus.previousYearBalances.casual > 0 && (
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    label="Casual Leave"
                                                    type="number"
                                                    fullWidth
                                                    size="small"
                                                    value={carryforwardAmounts.casual}
                                                    onChange={(e) => {
                                                        const val = Math.max(0, Math.min(
                                                            parseFloat(e.target.value) || 0,
                                                            carryforwardStatus.previousYearBalances.casual
                                                        ));
                                                        setCarryforwardAmounts(prev => ({ ...prev, casual: val }));
                                                    }}
                                                    inputProps={{ 
                                                        min: 0, 
                                                        max: carryforwardStatus.previousYearBalances.casual,
                                                        step: 0.5
                                                    }}
                                                    helperText={`Max: ${carryforwardStatus.previousYearBalances.casual} days`}
                                                />
                                            </Grid>
                                        )}
                                        {carryforwardStatus.previousYearBalances.paid > 0 && (
                                            <Grid item xs={12} sm={4}>
                                                <TextField
                                                    label="Planned Leave"
                                                    type="number"
                                                    fullWidth
                                                    size="small"
                                                    value={carryforwardAmounts.paid}
                                                    onChange={(e) => {
                                                        const val = Math.max(0, Math.min(
                                                            parseFloat(e.target.value) || 0,
                                                            carryforwardStatus.previousYearBalances.paid
                                                        ));
                                                        setCarryforwardAmounts(prev => ({ ...prev, paid: val }));
                                                    }}
                                                    inputProps={{ 
                                                        min: 0, 
                                                        max: carryforwardStatus.previousYearBalances.paid,
                                                        step: 0.5
                                                    }}
                                                    helperText={`Max: ${carryforwardStatus.previousYearBalances.paid} days`}
                                                />
                                            </Grid>
                                        )}
                                    </Grid>
                                    <Alert severity="info" sx={{ mt: 2 }}>
                                        Remaining leaves will be automatically encashed. Each leave type is carried forward separately.
                                    </Alert>
                                </Paper>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 2 }}>
                    <Button onClick={handleCloseCarryforwardModal} disabled={processingCarryforward}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmitCarryforwardDecision}
                        variant="contained"
                        disabled={processingCarryforward}
                        startIcon={processingCarryforward ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                        sx={{
                            bgcolor: '#667eea',
                            '&:hover': { bgcolor: '#5568d3' }
                        }}
                    >
                        {processingCarryforward ? 'Processing...' : 'Submit Decision'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Year-End Leave Options Modal */}
            <Dialog 
                open={yearEndModalOpen} 
                onClose={() => {
                    setYearEndModalOpen(false);
                    setYearEndSelections({});
                }}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '24px',
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(211, 47, 47, 0.25)',
                        border: '1px solid rgba(211, 47, 47, 0.1)',
                    }
                }}
            >
                <DialogTitle sx={{ 
                    background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                    color: 'white',
                    pb: 3,
                    pt: 3,
                    px: 3
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ 
                            bgcolor: 'rgba(255, 255, 255, 0.2)', 
                            borderRadius: '12px', 
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <ForwardIcon sx={{ fontSize: 28 }} />
                        </Box>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                                Year-End Leave Options
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                                Manage your remaining leave balance
                            </Typography>
                        </Box>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 3, px: 3, bgcolor: '#fafafa' }}>
                    {!yearEndFeatureEnabled ? (
                        <Alert 
                            severity="warning" 
                            sx={{ 
                                borderRadius: '12px',
                                bgcolor: '#fff3e0',
                                border: '2px solid #ff9800'
                            }}
                        >
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Year-End Leave Actions Unavailable
                            </Typography>
                            <Typography variant="body2">
                                {user?.employmentStatus !== 'Permanent' 
                                    ? 'Year-End Leave requests are only available for permanent employees.'
                                    : 'Year-End Leave actions are currently disabled by Admin.'}
                            </Typography>
                        </Alert>
                    ) : (
                        <>
                            <Alert 
                                severity="info" 
                                sx={{ 
                                    mb: 3,
                                    borderRadius: '12px',
                                    bgcolor: '#e3f2fd',
                                    border: '2px solid #2196f3',
                                    '& .MuiAlert-icon': {
                                        color: '#1976d2'
                                    }
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    Remaining Leave Balance
                                </Typography>
                                <Typography variant="body2">
                                    Choose whether to carry forward or encash your remaining leaves. Each leave type must be handled separately.
                                </Typography>
                            </Alert>

                            {/* Quick glance balances for all leave types */}
                            <Paper 
                                elevation={0}
                                sx={{ 
                                    mb: 3,
                                    p: 2,
                                    borderRadius: '12px',
                                    border: '1px solid #e0e0e0',
                                    bgcolor: '#ffffff'
                                }}
                            >
                                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                                    Current Leave Balances:
                                </Typography>
                                <Grid container spacing={2}>
                                    {['Sick', 'Casual', 'Planned'].map(type => {
                                        const balance = yearEndBalanceSummary[type] ?? 0;
                                        return (
                                            <Grid item xs={12} sm={4} key={type}>
                                                <Box 
                                                    sx={{ 
                                                        display: 'flex', 
                                                        flexDirection: 'column', 
                                                        gap: 0.5,
                                                        alignItems: 'flex-start'
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: '#666', fontWeight: 600 }}>
                                                        {type} Leave
                                                    </Typography>
                                                    <Chip 
                                                        label={`${balance} days`}
                                                        sx={{ 
                                                            fontWeight: 800, 
                                                            fontSize: '0.95rem',
                                                            bgcolor: balance > 0 ? '#e8f5e9' : '#f5f5f5',
                                                            color: balance > 0 ? '#2e7d32' : '#666'
                                                        }}
                                                    />
                                                </Box>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </Paper>
                            
                            {/* Year-End options for each leave type with remaining balance */}
                            {['Sick', 'Casual', 'Planned'].map(leaveType => {
                                const balance = getYearEndBalanceForType(leaveType);
                                const selection = yearEndSelections[leaveType];
                                
                                // Check if there's already a Year-End request for this leave type and year
                                const existingRequest = getExistingYearEndRequest(leaveType);
                                
                                if (balance <= 0 && !existingRequest) return null;
                                
                                return (
                                    <Paper 
                                        key={leaveType}
                                        elevation={0} 
                                        sx={{ 
                                            p: 3, 
                                            mb: 2.5, 
                                            bgcolor: 'white', 
                                            borderRadius: '16px',
                                            border: '2px solid #f5f5f5',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                borderColor: '#d32f2f',
                                                boxShadow: '0 4px 12px rgba(211, 47, 47, 0.1)'
                                            }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                                            <Box>
                                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#d32f2f', mb: 0.5 }}>
                                                    {leaveType} Leave
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>
                                                        {balance} days remaining
                                                    </Typography>
                                                    <Chip 
                                                        label={`${balance} days`}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: '#ffebee',
                                                            color: '#d32f2f',
                                                            fontWeight: 600,
                                                            height: '24px',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                            {existingRequest && (
                                                <Chip 
                                                    label={existingRequest.status} 
                                                    color={existingRequest.status === 'Approved' ? 'success' : existingRequest.status === 'Rejected' ? 'error' : 'warning'}
                                                    size="small"
                                                    sx={{ fontWeight: 600 }}
                                                />
                                            )}
                                        </Box>
                                        
                                        {existingRequest ? (
                                            <Box>
                                                <Alert 
                                                    severity={existingRequest.status === 'Approved' ? 'success' : existingRequest.status === 'Rejected' ? 'error' : 'warning'}
                                                    sx={{ 
                                                        mt: 2,
                                                        borderRadius: '12px'
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                                You have already submitted a Year-End request for this leave type.
                                                            </Typography>
                                                            {existingRequest.status === 'Pending' && (
                                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                                    Pending {existingRequest.yearEndSubType === 'CARRY_FORWARD' ? 'carry forward' : 'encashment'} request for {existingRequest.yearEndDays} day(s) in {existingRequest.yearEndYear || new Date().getFullYear()}. Waiting for admin approval.
                                                                </Typography>
                                                            )}
                                                            {existingRequest.status === 'Approved' && (
                                                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                                    Your {existingRequest.yearEndSubType === 'CARRY_FORWARD' ? 'carry forward' : 'encashment'} request for {existingRequest.yearEndDays} day(s) in {existingRequest.yearEndYear || new Date().getFullYear()} has been <strong>approved</strong>.
                                                                </Typography>
                                                            )}
                                                            {existingRequest.status === 'Rejected' && (
                                                                <>
                                                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                                        Your {existingRequest.yearEndSubType === 'CARRY_FORWARD' ? 'carry forward' : 'encashment'} request has been <strong>rejected</strong>.
                                                                    </Typography>
                                                                    {existingRequest.rejectionNotes && (
                                                                        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                                                            Reason: {existingRequest.rejectionNotes}
                                                                        </Typography>
                                                                    )}
                                                                </>
                                                            )}
                                                        </Box>
                                                        <Chip 
                                                            label={existingRequest.status} 
                                                            color={existingRequest.status === 'Approved' ? 'success' : existingRequest.status === 'Rejected' ? 'error' : 'warning'}
                                                            size="small"
                                                            sx={{ fontWeight: 600 }}
                                                        />
                                                    </Box>
                                                </Alert>
                                            </Box>
                                        ) : balance > 0 ? (
                                            <FormControl component="fieldset" sx={{ width: '100%' }}>
                                                <RadioGroup
                                                    value={selection?.subType || ''}
                                                    onChange={(e) => handleYearEndSelection(leaveType, e.target.value)}
                                                    sx={{ gap: 2 }}
                                                >
                                                    <FormControlLabel 
                                                        value="CARRY_FORWARD" 
                                                        disabled={!!existingRequest}
                                                        control={
                                                            <Radio 
                                                                sx={{
                                                                    color: '#d32f2f',
                                                                    '&.Mui-checked': { color: '#d32f2f' },
                                                                    '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.04)' }
                                                                }}
                                                            />
                                                        }
                                                        label={
                                                            <Box sx={{ 
                                                                ml: 1,
                                                                p: 2,
                                                                borderRadius: '12px',
                                                                border: '2px solid',
                                                                borderColor: selection?.subType === 'CARRY_FORWARD' ? '#d32f2f' : '#e0e0e0',
                                                                bgcolor: selection?.subType === 'CARRY_FORWARD' ? '#ffebee' : 'white',
                                                                transition: 'all 0.2s ease',
                                                                cursor: existingRequest ? 'not-allowed' : 'pointer',
                                                                opacity: existingRequest ? 0.6 : 1,
                                                                '&:hover': existingRequest ? {} : { borderColor: '#d32f2f', bgcolor: '#ffebee' }
                                                            }}>
                                                                <Typography variant="body1" sx={{ fontWeight: 700, color: '#d32f2f', mb: 0.5 }}>
                                                                    Carry Forward
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ color: '#666' }}>
                                                                    Add {balance} day(s) to next year's {leaveType} leave balance
                                                                </Typography>
                                                            </Box>
                                                        }
                                                        sx={{ m: 0, '& .MuiFormControlLabel-label': { width: '100%' } }}
                                                    />
                                                    <FormControlLabel 
                                                        value="ENCASH" 
                                                        disabled={!!existingRequest}
                                                        control={
                                                            <Radio 
                                                                sx={{
                                                                    color: '#d32f2f',
                                                                    '&.Mui-checked': { color: '#d32f2f' },
                                                                    '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.04)' }
                                                                }}
                                                            />
                                                        }
                                                        label={
                                                            <Box sx={{ 
                                                                ml: 1,
                                                                p: 2,
                                                                borderRadius: '12px',
                                                                border: '2px solid',
                                                                borderColor: selection?.subType === 'ENCASH' ? '#d32f2f' : '#e0e0e0',
                                                                bgcolor: selection?.subType === 'ENCASH' ? '#ffebee' : 'white',
                                                                transition: 'all 0.2s ease',
                                                                cursor: existingRequest ? 'not-allowed' : 'pointer',
                                                                opacity: existingRequest ? 0.6 : 1,
                                                                '&:hover': existingRequest ? {} : { borderColor: '#d32f2f', bgcolor: '#ffebee' }
                                                            }}>
                                                                <Typography variant="body1" sx={{ fontWeight: 700, color: '#d32f2f', mb: 0.5 }}>
                                                                    Encash
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ color: '#666' }}>
                                                                    Cash out {balance} day(s) of {leaveType} leave
                                                                </Typography>
                                                            </Box>
                                                        }
                                                        sx={{ m: 0, '& .MuiFormControlLabel-label': { width: '100%' } }}
                                                    />
                                                </RadioGroup>
                                            </FormControl>
                                        ) : (
                                            <Alert severity="warning" sx={{ mt: 1, borderRadius: '12px' }}>
                                                No remaining days available for this leave type.
                                            </Alert>
                                        )}
                                    </Paper>
                                );
                            })}
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 2, bgcolor: 'white', borderTop: '1px solid #f5f5f5' }}>
                    <Button 
                        onClick={() => {
                            setYearEndModalOpen(false);
                            setYearEndSelections({});
                        }}
                        disabled={processingYearEnd}
                        sx={{
                            color: '#666',
                            fontWeight: 600,
                            px: 3,
                            py: 1,
                            '&:hover': { bgcolor: '#f5f5f5' }
                        }}
                    >
                        Cancel
                    </Button>
                    {yearEndFeatureEnabled && Object.keys(yearEndSelections).some(lt => {
                        const existing = getExistingYearEndRequest(lt);
                        const hasSelection = yearEndSelections[lt]?.subType;
                        const hasBalance = getYearEndBalanceForType(lt) > 0;
                        // Only enable submit if no existing request AND has selection AND has balance
                        return !existing && hasSelection && hasBalance;
                    }) && (
                        <Button
                            onClick={handleSubmitYearEndRequests}
                            variant="contained"
                            disabled={processingYearEnd}
                            startIcon={processingYearEnd ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CheckCircleIcon />}
                            sx={{
                                bgcolor: '#d32f2f',
                                color: 'white',
                                fontWeight: 700,
                                px: 4,
                                py: 1,
                                borderRadius: '12px',
                                textTransform: 'none',
                                boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
                                '&:hover': { 
                                    bgcolor: '#c62828',
                                    boxShadow: '0 6px 16px rgba(211, 47, 47, 0.4)',
                                    transform: 'translateY(-1px)'
                                },
                                '&.Mui-disabled': {
                                    bgcolor: 'rgba(211, 47, 47, 0.3)',
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    boxShadow: 'none'
                                },
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {processingYearEnd ? 'Processing...' : 'Submit'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            <Snackbar 
                open={snackbar.open} 
                autoHideDuration={5000} 
                onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })} severity={snackbar.severity || 'success'} sx={{ width: '100%' }} variant="filled">
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default LeavesPage;