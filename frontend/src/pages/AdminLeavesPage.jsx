// src/pages/AdminLeavesPage.jsx
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import {
    Typography, Button, CircularProgress, Alert, Chip, Box, Snackbar, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Paper, Grid, Divider, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Tooltip, IconButton, Stack, TablePagination,
    Menu, MenuItem, ListItemIcon, ListItemText, Tabs, Tab, Switch, FormControlLabel, Skeleton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EmailIcon from '@mui/icons-material/Email';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AdminLeaveForm from '../components/AdminLeaveForm';
import EnhancedLeaveRequestModal from '../components/EnhancedLeaveRequestModal';
import PageHeroHeader from '../components/PageHeroHeader';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import '../styles/AdminLeavesPage.css'; // Import the new stylesheet
import { TableSkeleton } from '../components/SkeletonLoaders';

// --- HrEmailManager Modal ---
const HrEmailManagerModal = memo(({ open, onClose }) => {
    const [emails, setEmails] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchEmails = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        try {
            const { data } = await api.get('/admin/settings/hr-emails');
            setEmails(Array.isArray(data) ? data : []);
        } catch (err) {
            setError('Failed to load HR emails.');
        } finally {
            setLoading(false);
        }
    }, [open]);

    useEffect(() => { fetchEmails(); }, [fetchEmails]);

    const handleAddEmail = async () => {
        if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
            setError('Please enter a valid email address.');
            return;
        }
        setError('');
        const originalEmails = [...emails];
        setEmails(prev => [...prev, newEmail]);
        setNewEmail('');
        try {
            const { data } = await api.post('/admin/settings/hr-emails', { email: newEmail });
            setEmails(data);
        } catch (err) {
            setEmails(originalEmails);
            setError(err.response?.data?.error || 'Failed to add email.');
        }
    };

    const handleDeleteEmail = async (emailToDelete) => {
        const originalEmails = [...emails];
        setEmails(prev => prev.filter(email => email !== emailToDelete));
        try {
            const { data } = await api.delete('/admin/settings/hr-emails', { data: { email: emailToDelete } });
            setEmails(data);
        } catch (err) {
            setEmails(originalEmails);
            setError(err.response?.data?.error || 'Failed to delete email.');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <EmailIcon />
                    Notification Recipients
                </Box>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Add or remove email addresses that receive leave request notifications.
                </Typography>
                {loading ? <CircularProgress size={24} /> : (
                    <>
                        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs><TextField label="Add new recipient email" variant="outlined" size="small" fullWidth value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()} /></Grid>
                            <Grid item xs="auto"><Button variant="contained" onClick={handleAddEmail} sx={{ bgcolor: 'var(--theme-red)', '&:hover': { bgcolor: '#A02020' } }}>Add</Button></Grid>
                        </Grid>
                        <Divider sx={{ my: 3 }} />
                        <div className="recipients-box">
                            {emails.length > 0 ? (
                                emails.map(email => (<Chip key={email} label={email} onDelete={() => handleDeleteEmail(email)} variant="outlined" />))
                            ) : (
                                <div className="no-recipients-box"><InfoOutlinedIcon fontSize="small" /><Typography variant="body2">No recipient emails are configured.</Typography></div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
});

// --- HolidayManager Modal ---
const HolidayManagerModal = memo(({ open, onClose }) => {
    const [holidays, setHolidays] = useState([]);
    const [newHoliday, setNewHoliday] = useState({ name: '', date: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchHolidays = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        try {
            const { data } = await api.get('/admin/holidays');
            setHolidays(Array.isArray(data) ? data : []);
        } catch (err) { setError('Failed to load holidays.'); } finally { setLoading(false); }
    }, [open]);

    useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

    const handleAddHoliday = async () => {
        if (!newHoliday.name || !newHoliday.date) {
            setError('Please provide both a name and a date for the holiday.');
            return;
        }
        setError('');
        try {
            await api.post('/admin/holidays', newHoliday);
            setNewHoliday({ name: '', date: null });
            fetchHolidays();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add holiday.');
        }
    };

    const handleDeleteHoliday = async (holidayId) => {
        try {
            await api.delete(`/admin/holidays/${holidayId}`);
            fetchHolidays();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete holiday.');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CalendarMonthIcon />Holiday Management
                </Box>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Add or remove company-wide holidays.</Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}><TextField label="Holiday Name" size="small" fullWidth value={newHoliday.name} onChange={(e) => setNewHoliday(p => ({ ...p, name: e.target.value }))} /></Grid>
                    <Grid item xs={12} sm={4}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker label="Holiday Date" value={newHoliday.date} onChange={(d) => setNewHoliday(p => ({ ...p, date: d }))} slotProps={{ textField: { size: 'small', fullWidth: true } }} />
                        </LocalizationProvider>
                    </Grid>
                    <Grid item xs={12} sm={2}><Button variant="contained" fullWidth onClick={handleAddHoliday}>Add</Button></Grid>
                </Grid>
                <Divider sx={{ my: 3 }} />
                <div className="recipients-box">
                    {loading ? <CircularProgress size={20} /> : holidays.length > 0 ? (
                        holidays.map(h => (<Chip key={h._id} label={`${h.name} (${new Date(h.date).toLocaleDateString()})`} onDelete={() => handleDeleteHoliday(h._id)} />))
                    ) : (
                        <div className="no-recipients-box"><InfoOutlinedIcon fontSize="small" /><Typography variant="body2">No holidays configured.</Typography></div>
                    )}
                </div>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
});


const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

// Utility function to convert individual dates to date ranges
const formatDateRange = (dateStrings) => {
    if (!dateStrings || dateStrings.length === 0) return 'N/A';
    
    // Convert to Date objects and sort
    const dates = dateStrings
        .map(dateStr => new Date(dateStr))
        .filter(date => !isNaN(date.getTime()))
        .sort((a, b) => a - b);
    
    if (dates.length === 0) return 'N/A';
    if (dates.length === 1) return formatDate(dates[0]);
    
    // Group consecutive dates into ranges
    const ranges = [];
    let start = dates[0];
    let end = dates[0];
    
    for (let i = 1; i < dates.length; i++) {
        const currentDate = dates[i];
        const previousDate = dates[i - 1];
        const dayDiff = (currentDate - previousDate) / (1000 * 60 * 60 * 24);
        
        if (dayDiff === 1) {
            // Consecutive date, extend the range
            end = currentDate;
        } else {
            // Gap found, save current range and start new one
            ranges.push({ start, end });
            start = currentDate;
            end = currentDate;
        }
    }
    
    // Add the last range
    ranges.push({ start, end });
    
    // Format ranges
    return ranges.map(range => {
        if (range.start.getTime() === range.end.getTime()) {
            return formatDate(range.start);
        } else {
            return `${formatDate(range.start)} to ${formatDate(range.end)}`;
        }
    }).join(', ');
};

// Utility function to count total leave days
const countLeaveDays = (dateStrings) => {
    if (!dateStrings || dateStrings.length === 0) return 0;
    return dateStrings.length;
};

const RequestRow = memo(({ request, index, onEdit, onDelete, onStatusChange, onViewDetails }) => {
    const statusColors = { Pending: 'warning', Approved: 'success', Rejected: 'error' };

    return (
        <TableRow 
            hover 
            className="request-table-row" 
            onClick={() => onViewDetails(request)}
            style={{ cursor: 'pointer' }}
        >
            <TableCell>{index + 1}</TableCell>
            <TableCell>
                <Typography className="employee-name">{request.employee?.fullName || 'N/A'}</Typography>
                <Typography variant="body2" className="employee-code">{request.employee?.employeeCode || ''}</Typography>
            </TableCell>
            <TableCell>{formatLeaveRequestType(request.requestType)}</TableCell>
            <TableCell>{request.leaveType}</TableCell>
            <TableCell>
                {request.requestType === 'Compensatory' && request.alternateDate ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Chip 
                                label={`${countLeaveDays(request.leaveDates)} day${countLeaveDays(request.leaveDates) !== 1 ? 's' : ''}`} 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', minWidth: '60px', justifyContent: 'center' }}
                            />
                            <Box>
                                <Typography variant="body2" component="div">
                                    Leave: <strong>{formatDateRange(request.leaveDates)}</strong>
                                </Typography>
                            </Box>
                        </Box>
                        <Typography variant="caption" color="textSecondary" sx={{ ml: 7 }}>
                            Alternate Work: {formatDate(request.alternateDate)}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Chip 
                            label={`${countLeaveDays(request.leaveDates)} day${countLeaveDays(request.leaveDates) !== 1 ? 's' : ''}`} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', minWidth: '60px', justifyContent: 'center' }}
                        />
                        <Typography variant="body2" component="div">
                            {formatDateRange(request.leaveDates)}
                        </Typography>
                    </Box>
                )}
            </TableCell>
            <TableCell>
                <Chip label={request.status} color={statusColors[request.status] || 'default'} size="small" />
            </TableCell>
            <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                <div className="actions-cell">
                    <Tooltip title="View Details"><IconButton size="small" onClick={() => onViewDetails(request)}><InfoOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => onEdit(request)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" onClick={() => onDelete(request)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                </div>
            </TableCell>
        </TableRow>
    );
});

const AdminLeavesPage = () => {
    const [requests, setRequests] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, request: null });
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    
    // Pagination state
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    
    // Modal states for leave details
    const [viewDialog, setViewDialog] = useState({ open: false, request: null });
    
    // Year-end actions state
    const [yearEndActions, setYearEndActions] = useState([]);
    const [yearEndLoading, setYearEndLoading] = useState(false);
    const [currentTab, setCurrentTab] = useState(0);
    const [yearEndRejectDialog, setYearEndRejectDialog] = useState({ open: false, action: null, notes: '' });
    const [yearEndDeleteDialog, setYearEndDeleteDialog] = useState({ open: false, action: null, isApproved: false });
    const [highlightedActionId, setHighlightedActionId] = useState(null);
    const [yearEndFeatureEnabled, setYearEndFeatureEnabled] = useState(false);
    const [featureToggleLoading, setFeatureToggleLoading] = useState(false);
    
    // Year-end view dialog state
    const [yearEndViewDialog, setYearEndViewDialog] = useState({ open: false, action: null });
    
    // Query params for deep linking
    const [searchParams, setSearchParams] = useSearchParams();

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [reqRes, empRes] = await Promise.all([
                api.get(`/admin/leaves/all?page=${page + 1}&limit=${rowsPerPage}`),
                api.get('/admin/employees?all=true')
            ]);
            
            // Handle paginated response for requests
            if (reqRes.data.requests) {
                setRequests(Array.isArray(reqRes.data.requests) ? reqRes.data.requests : []);
                setTotalCount(reqRes.data.totalCount || 0);
            } else {
                setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
            }
            
            // Handle paginated response for employees
            if (empRes.data.employees) {
                setEmployees(Array.isArray(empRes.data.employees) ? empRes.data.employees : []);
            } else {
                setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
            }
        } catch (err) {
            setError('Failed to fetch leave management data.');
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage]);
    
    const fetchYearEndActions = useCallback(async () => {
        setYearEndLoading(true);
        try {
            const res = await api.get('/admin/leaves/year-end-requests');
            if (res.data.requests) {
                setYearEndActions(Array.isArray(res.data.requests) ? res.data.requests : []);
            } else {
                setYearEndActions(Array.isArray(res.data) ? res.data : []);
            }
        } catch (err) {
            console.error('Failed to fetch year-end actions:', err);
            setYearEndActions([]);
        } finally {
            setYearEndLoading(false);
        }
    }, []);
    
    const fetchYearEndFeatureStatus = useCallback(async () => {
        try {
            const res = await api.get('/admin/settings/year-end-feature');
            setYearEndFeatureEnabled(res.data.enabled || false);
        } catch (err) {
            console.error('Failed to fetch year-end feature status:', err);
        }
    }, []);
    
    const handleToggleYearEndFeature = async (event) => {
        const newValue = event.target.checked;
        setFeatureToggleLoading(true);
        try {
            await api.post('/admin/settings/year-end-feature', { enabled: newValue });
            setYearEndFeatureEnabled(newValue);
            setSnackbar({ open: true, message: `Year-end leave feature ${newValue ? 'enabled' : 'disabled'} successfully!`, severity: 'success' });
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to update feature setting.', severity: 'error' });
        } finally {
            setFeatureToggleLoading(false);
        }
    };
    
    // Pre-fetch year-end data on mount to prevent delay on first toggle
    useEffect(() => {
        fetchYearEndActions();
        fetchYearEndFeatureStatus();
    }, [fetchYearEndActions, fetchYearEndFeatureStatus]);
    
    // Handle URL parameters for deep linking from notifications
    useEffect(() => {
        const tab = searchParams.get('tab');
        const actionId = searchParams.get('actionId');
        const leaveId = searchParams.get('leaveId');
        
        if (tab === 'year-end') {
            // Activate Year-End tab (index 1)
            setCurrentTab(1);
            // Fetch Year-End requests if not already loaded
            if (yearEndActions.length === 0) {
                fetchYearEndActions();
            }
            // Set highlighted request ID if provided
            if (actionId) {
                setHighlightedActionId(actionId);
                // Scroll to highlighted row after data loads
                const scrollToAction = () => {
                    const element = document.getElementById(`action-${actionId}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Highlight the row
                        element.style.backgroundColor = '#fff3cd';
                        setTimeout(() => {
                            element.style.backgroundColor = '';
                        }, 3000);
                    } else if (yearEndActions.length > 0) {
                        // Retry if data just loaded
                        setTimeout(scrollToAction, 200);
                    }
                };
                // Wait for data to load, then scroll
                setTimeout(scrollToAction, 500);
            }
            // Clean up URL params after processing (optional - keeps URL clean)
            // Uncomment if you want to remove params after processing:
            // const newParams = new URLSearchParams(searchParams);
            // newParams.delete('tab');
            // newParams.delete('actionId');
            // setSearchParams(newParams, { replace: true });
        } else if (tab === 'requests') {
            setCurrentTab(0);
            if (leaveId) {
                // Scroll to the leave request after data loads
                setTimeout(() => {
                    const element = document.getElementById(`leave-${leaveId}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.style.backgroundColor = '#fff3cd';
                        setTimeout(() => {
                            element.style.backgroundColor = '';
                        }, 3000);
                    }
                }, 500);
            }
        }
    }, [searchParams, setSearchParams, fetchYearEndActions, yearEndActions.length]);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
    
    // Smart refresh strategy: Refresh when page becomes visible and periodically while visible
    useEffect(() => {
        let refreshInterval = null;
        const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes when page is visible (admin needs more frequent updates)
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
            fetchInitialData();
                    wasHidden = false;
                }
                
                // Start periodic refresh while page is visible
                if (!refreshInterval) {
                    refreshInterval = setInterval(() => {
                        // Only refresh if page is still visible
                        if (!document.hidden) {
                            fetchInitialData();
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
                    fetchInitialData();
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
    }, [fetchInitialData]);

    const handleOpenForm = (request = null) => { setSelectedRequest(request); setIsFormOpen(true); };
    const handleCloseForm = () => { setSelectedRequest(null); setIsFormOpen(false); };

    const handleSaveRequest = async (formData) => {
        try {
            if (formData._id) {
                await api.put(`/admin/leaves/${formData._id}`, formData);
                setSnackbar({ open: true, message: 'Request updated successfully!', severity: 'success' });
            } else {
                await api.post('/admin/leaves', formData);
                setSnackbar({ open: true, message: 'Request created successfully!', severity: 'success' });
            }
            handleCloseForm();
            fetchInitialData();
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to save request.', severity: 'error' });
        }
    };

    const handleStatusChange = async (requestId, status, rejectionNotes = '') => {
        try {
            const payload = { status };
            if (status === 'Rejected' && rejectionNotes) {
                payload.rejectionNotes = rejectionNotes;
            }
            await api.patch(`/admin/leaves/${requestId}/status`, payload);
            setSnackbar({ open: true, message: `Leave request has been ${status.toLowerCase()}.`, severity: 'success' });
            fetchInitialData();
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Action failed.', severity: 'error' });
        }
    };
    
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

    const handleMoreMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
        setMoreMenuOpen(true);
    };

    const handleMoreMenuClose = () => {
        setAnchorEl(null);
        setMoreMenuOpen(false);
    };

    const handleLeavesTrackerClick = () => {
        handleMoreMenuClose();
        window.location.href = '/admin/leaves/more-options/leaves-tracker';
    };
    
    const handleApproveYearEndAction = async (requestId) => {
        try {
            await api.patch(`/admin/leaves/year-end/${requestId}/status`, { status: 'Approved' });
            setSnackbar({ open: true, message: 'Year-End request approved successfully!', severity: 'success' });
            fetchYearEndActions();
            fetchInitialData(); // Refresh main requests list too
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to approve request.', severity: 'error' });
        }
    };
    
    const handleRejectYearEndAction = async () => {
        if (!yearEndRejectDialog.action) return;
        try {
            await api.patch(`/admin/leaves/year-end/${yearEndRejectDialog.action._id}/status`, {
                status: 'Rejected',
                rejectionNotes: yearEndRejectDialog.notes
            });
            setSnackbar({ open: true, message: 'Year-End request rejected successfully!', severity: 'success' });
            setYearEndRejectDialog({ open: false, action: null, notes: '' });
            fetchYearEndActions();
            fetchInitialData(); // Refresh main requests list too
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to reject request.', severity: 'error' });
        }
    };
    
    // Helper: get remaining days from Year-End request
    const getRemainingDaysDisplay = (request) => {
        if (!request) return 0;
        // Use yearEndDays from the request
        return request.yearEndDays || 0;
    };
    
    // Year-end CRUD handlers
    const handleViewYearEndAction = (action) => {
        setYearEndViewDialog({ open: true, action });
    };
    
    const handleDeleteYearEndAction = async (requestId, isApproved = false) => {
        try {
            const response = await api.delete(`/admin/leaves/year-end/${requestId}`);
            setSnackbar({ 
                open: true, 
                message: response.data?.message || (isApproved 
                    ? 'Year-End request deleted successfully. Leave balance changes have been reverted.' 
                    : 'Year-End request deleted successfully!'), 
                severity: 'success' 
            });
            setYearEndDeleteDialog({ open: false, action: null, isApproved: false });
            fetchYearEndActions();
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to delete Year-End request.', severity: 'error' });
        }
    };

    const handleDelete = (request) => { setDeleteDialog({ open: true, request }); };

    const handleEdit = (request) => {
        setSelectedRequest(request);
        setIsFormOpen(true);
    };

    const confirmDelete = async () => {
        const requestToDelete = deleteDialog.request;
        if (!requestToDelete) return;
        try {
            await api.delete(`/admin/leaves/${requestToDelete._id}`);
            setSnackbar({ open: true, message: 'Request deleted!', severity: 'success' });
            setDeleteDialog({ open: false, request: null });
            fetchInitialData();
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to delete request.', severity: 'error' });
        }
    };

    if (loading) {
        return (
            <div className="admin-leaves-page">
                <Box sx={{ mb: 3 }}>
                    <Skeleton variant="rectangular" width="40%" height={60} sx={{ mb: 2, borderRadius: 1 }} />
                    <Skeleton variant="text" width="60%" height={32} />
                </Box>
                <Paper elevation={0} sx={{ mb: 3 }}>
                    <Box sx={{ p: 2 }}>
                        <Stack direction="row" spacing={2}>
                            <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="rectangular" width={180} height={40} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="rectangular" width={160} height={40} sx={{ borderRadius: 1 }} />
                        </Stack>
                    </Box>
                </Paper>
                <Paper elevation={0} className="requests-card">
                    <TableSkeleton rows={8} columns={7} minHeight="600px" />
                </Paper>
            </div>
        );
    }

    return (
        <div className="admin-leaves-page">
            <PageHeroHeader
                eyebrow="Operations Control"
                title="Leave Management"
                description="Monitor, approve, and organize backdated leave workflows with real-time insights."
                actionArea={
                    <Stack
                        direction="row"
                        spacing={1.5}
                        flexWrap="wrap"
                        justifyContent="flex-end"
                        alignItems="center"
                    >
                        <Button 
                            variant="contained" 
                            onClick={() => handleOpenForm()} 
                            startIcon={<AddIcon />}
                            sx={{ 
                                bgcolor: '#dc3545', 
                                '&:hover': { bgcolor: '#c82333' } 
                            }}
                        >
                            Log Request
                        </Button>
                        <Button 
                            variant="contained" 
                            startIcon={<EmailIcon />} 
                            onClick={() => setIsEmailModalOpen(true)}
                            sx={{ 
                                bgcolor: '#dc3545', 
                                '&:hover': { bgcolor: '#c82333' } 
                            }}
                        >
                            Manage Recipients
                        </Button>
                        <Button 
                            variant="contained" 
                            startIcon={<CalendarMonthIcon />} 
                            onClick={() => setIsHolidayModalOpen(true)}
                            sx={{ 
                                bgcolor: '#dc3545', 
                                '&:hover': { bgcolor: '#c82333' } 
                            }}
                        >
                            Manage Holidays
                        </Button>
                        <Tooltip title="More Options">
                            <IconButton 
                                size="small" 
                                onClick={handleMoreMenuClick}
                                sx={{
                                    border: '2px solid #000000',
                                    borderRadius: '4px',
                                    '&:hover': {
                                        border: '2px solid #000000',
                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                    }
                                }}
                            >
                                <MoreVertIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                }
            />

            {error && <Alert severity="error" className="error-alert">{error}</Alert>}
            
            <Paper elevation={0} sx={{ mb: 3 }}>
                <Tabs 
                    value={currentTab} 
                    onChange={(e, newValue) => setCurrentTab(newValue)}
                    sx={{
                        '& .MuiTabs-indicator': {
                            backgroundColor: '#1976d2',
                            transition: 'all 0.3s ease-in-out',
                        },
                        '& .MuiTab-root': {
                            transition: 'color 0.2s ease-in-out',
                            border: 'none !important',
                            borderTop: 'none !important',
                            borderRight: 'none !important',
                            borderBottom: 'none !important',
                            borderLeft: 'none !important',
                            outline: 'none !important',
                            boxShadow: 'none !important',
                            '&.Mui-selected': {
                                border: 'none !important',
                                borderTop: 'none !important',
                                borderRight: 'none !important',
                                borderBottom: 'none !important',
                                borderLeft: 'none !important',
                                outline: 'none !important',
                                boxShadow: 'none !important'
                            },
                            '&::before': {
                                display: 'none !important'
                            },
                            '&::after': {
                                display: 'none !important'
                            }
                        }
                    }}
                >
                    <Tab label="Leave Requests" />
                    <Tab label="Year-End Requests" />
                </Tabs>
            </Paper>
            
            {/* Tab Content Container - Dynamic height wrapper for smooth transitions */}
            <Box
                sx={{
                    position: 'relative',
                    minHeight: '400px', // Prevent layout collapse
                    width: '100%',
                }}
            >
                {/* Leave Requests Tab - Always mounted, visibility toggled */}
                <Box
                    sx={{
                        position: currentTab === 0 ? 'relative' : 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        opacity: currentTab === 0 ? 1 : 0,
                        transform: currentTab === 0 ? 'translateY(0)' : 'translateY(8px)',
                        pointerEvents: currentTab === 0 ? 'auto' : 'none',
                        transition: 'opacity 220ms ease-in-out, transform 220ms ease-in-out',
                        willChange: currentTab === 0 ? 'auto' : 'opacity, transform',
                        zIndex: currentTab === 0 ? 1 : 0,
                        visibility: currentTab === 0 ? 'visible' : 'hidden',
                    }}
                >
                    <div className="requests-card">
                        <TableContainer component={Paper} elevation={0} className="table-container">
                            <Table stickyHeader aria-label="leave requests table">
                                <TableHead className="requests-table-head">
                                    <TableRow>
                                        <TableCell sx={{ width: '60px' }}>S.No.</TableCell>
                                        <TableCell>Employee</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Day Type</TableCell>
                                        <TableCell>Date(s)</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="center">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {requests.map((request, index) => (
                                        <RequestRow 
                                            key={request._id} 
                                            request={request} 
                                            index={index} 
                                            onEdit={handleOpenForm} 
                                            onDelete={handleDelete}
                                            onStatusChange={handleStatusChange}
                                            onViewDetails={handleViewDetails}
                                        />
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
                        />
                    </div>
                </Box>
                
                {/* Year-End Requests Tab - Always mounted, visibility toggled */}
                <Box
                    sx={{
                        position: currentTab === 1 ? 'relative' : 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        opacity: currentTab === 1 ? 1 : 0,
                        transform: currentTab === 1 ? 'translateY(0)' : 'translateY(8px)',
                        pointerEvents: currentTab === 1 ? 'auto' : 'none',
                        transition: 'opacity 220ms ease-in-out, transform 220ms ease-in-out',
                        willChange: currentTab === 1 ? 'auto' : 'opacity, transform',
                        zIndex: currentTab === 1 ? 1 : 0,
                        visibility: currentTab === 1 ? 'visible' : 'hidden',
                    }}
                >
                    <div className="requests-card">
                    {/* Feature Toggle Section */}
                    <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    Year-End Leave Feature
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Enable or disable the year-end leave carry forward and encashment feature for employees.
                                </Typography>
                            </Box>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={yearEndFeatureEnabled}
                                        onChange={handleToggleYearEndFeature}
                                        disabled={featureToggleLoading}
                                        color="primary"
                                    />
                                }
                                label={yearEndFeatureEnabled ? 'Enabled' : 'Disabled'}
                            />
                        </Box>
                    </Paper>
                    
                    {yearEndLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <TableContainer component={Paper} elevation={0}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Employee Name</TableCell>
                                        <TableCell>Leave Type</TableCell>
                                        <TableCell>Year</TableCell>
                                        <TableCell>Days</TableCell>
                                        <TableCell>Action</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell align="center">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {yearEndActions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    No year-end leave requests found.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        yearEndActions.map((action) => (
                                            <TableRow 
                                                key={action._id} 
                                                id={`action-${action._id}`}
                                                hover
                                                sx={{
                                                    backgroundColor: highlightedActionId === action._id ? '#fff3cd' : 'inherit',
                                                    transition: 'background-color 0.3s'
                                                }}
                                            >
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {action.employee?.fullName || 'N/A'}
                                                    </Typography>
                                                    {action.employee?.employeeCode && (
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            {action.employee.employeeCode}
                                                        </Typography>
                                                    )}
                                                    {action.employee?.department && (
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            {action.employee.department}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>{action.yearEndLeaveType || 'N/A'}</TableCell>
                                                <TableCell>{action.yearEndYear || new Date().getFullYear()}</TableCell>
                                                <TableCell>{getRemainingDaysDisplay(action)}</TableCell>
                                                <TableCell>
                                                    {action.yearEndSubType ? (
                                                        <Chip 
                                                            label={action.yearEndSubType === 'CARRY_FORWARD' ? 'Carry Forward' : 'Encash'}
                                                            color={action.yearEndSubType === 'CARRY_FORWARD' ? 'primary' : 'success'}
                                                            size="small"
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            Not selected
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={action.status}
                                                        color={
                                                            action.status === 'Approved' ? 'success' :
                                                            action.status === 'Rejected' ? 'error' :
                                                            action.status === 'Completed' ? 'info' : 'warning'
                                                        }
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {action.createdAt ? new Date(action.createdAt).toLocaleDateString() : 'N/A'}
                                                </TableCell>
                                                <TableCell 
                                                    align="center" 
                                                    onClick={(e) => e.stopPropagation()}
                                                    sx={{ 
                                                        minWidth: '150px',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                                                        <Tooltip title="View Details">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewYearEndAction(action);
                                                                }}
                                                                sx={{ 
                                                                    color: '#1976d2',
                                                                    '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.1)' }
                                                                }}
                                                            >
                                                                <InfoOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {action.status === 'Pending' && action.yearEndSubType && (
                                                            <>
                                                                <Tooltip title="Approve">
                                                                    <IconButton
                                                                        size="small"
                                                                        color="success"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleApproveYearEndAction(action._id);
                                                                        }}
                                                                        sx={{ 
                                                                            '&:hover': { backgroundColor: 'rgba(46, 125, 50, 0.1)' }
                                                                        }}
                                                                    >
                                                                        <CheckCircleOutlineIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Reject">
                                                                    <IconButton
                                                                        size="small"
                                                                        color="error"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setYearEndRejectDialog({ open: true, action, notes: '' });
                                                                        }}
                                                                        sx={{ 
                                                                            '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.1)' }
                                                                        }}
                                                                    >
                                                                        <HighlightOffIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </>
                                                        )}
                                                        {(action.status === 'Pending' || action.status === 'Approved') && (
                                                            <Tooltip title="Delete">
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setYearEndDeleteDialog({ 
                                                                            open: true, 
                                                                            action: action,
                                                                            isApproved: action.status === 'Approved'
                                                                        });
                                                                    }}
                                                                    sx={{ 
                                                                        '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.1)' }
                                                                    }}
                                                                >
                                                                    <DeleteOutlineIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                    </div>
                </Box>
            </Box>

            {isFormOpen && <AdminLeaveForm open={isFormOpen} onClose={handleCloseForm} onSave={handleSaveRequest} request={selectedRequest} employees={employees} />}
            
            
            <HrEmailManagerModal open={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
            <HolidayManagerModal open={isHolidayModalOpen} onClose={() => setIsHolidayModalOpen(false)} />

            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, request: null })}><DialogTitle>Confirm Deletion</DialogTitle><DialogContent>Are you sure you want to delete this leave request?</DialogContent><DialogActions><Button onClick={() => setDeleteDialog({ open: false, request: null })}>Cancel</Button><Button onClick={confirmDelete} color="error" variant="contained">Delete</Button></DialogActions></Dialog>
            
            {/* Year-End View Details Dialog */}
            <Dialog open={yearEndViewDialog.open} onClose={() => setYearEndViewDialog({ open: false, action: null })} fullWidth maxWidth="sm">
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <InfoOutlinedIcon />
                        Year-End Leave Request Details
                    </Box>
                </DialogTitle>
                <DialogContent>
                                    {yearEndViewDialog.action && (
                                        <Stack spacing={2} sx={{ mt: 1 }}>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Employee</Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                    {yearEndViewDialog.action.employee?.fullName || 'N/A'}
                                                </Typography>
                                                {yearEndViewDialog.action.employee?.employeeCode && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        Code: {yearEndViewDialog.action.employee.employeeCode}
                                                    </Typography>
                                                )}
                                                {yearEndViewDialog.action.employee?.department && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        Department: {yearEndViewDialog.action.employee.department}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Divider />
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Leave Type</Typography>
                                                    <Typography variant="body1">{yearEndViewDialog.action.yearEndLeaveType || 'N/A'}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Year</Typography>
                                                    <Typography variant="body1">{yearEndViewDialog.action.yearEndYear || new Date().getFullYear()}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Days</Typography>
                                                    <Typography variant="body1">{yearEndViewDialog.action.yearEndDays || 0}</Typography>
                                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Status</Typography>
                                    <Chip 
                                        label={yearEndViewDialog.action.status}
                                        color={
                                            yearEndViewDialog.action.status === 'Approved' ? 'success' :
                                            yearEndViewDialog.action.status === 'Rejected' ? 'error' : 'warning'
                                        }
                                        size="small"
                                    />
                                </Grid>
                                {yearEndViewDialog.action.yearEndSubType && (
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Requested Action</Typography>
                                        <Chip 
                                            label={yearEndViewDialog.action.yearEndSubType === 'CARRY_FORWARD' ? 'Carry Forward' : 'Encash'}
                                            color={yearEndViewDialog.action.yearEndSubType === 'CARRY_FORWARD' ? 'primary' : 'success'}
                                            size="small"
                                        />
                                    </Grid>
                                )}
                                {yearEndViewDialog.action.createdAt && (
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Requested At</Typography>
                                        <Typography variant="body1">
                                            {new Date(yearEndViewDialog.action.createdAt).toLocaleString()}
                                        </Typography>
                                    </Grid>
                                )}
                                {yearEndViewDialog.action.approvedAt && (
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Processed At</Typography>
                                        <Typography variant="body1">
                                            {new Date(yearEndViewDialog.action.approvedAt).toLocaleString()}
                                        </Typography>
                                    </Grid>
                                )}
                                {yearEndViewDialog.action.approvedBy && (
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Processed By</Typography>
                                        <Typography variant="body1">
                                            {yearEndViewDialog.action.approvedBy?.fullName || 'N/A'}
                                        </Typography>
                                    </Grid>
                                )}
                            </Grid>
                            {yearEndViewDialog.action.rejectionNotes && (
                                <>
                                    <Divider />
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Rejection Notes</Typography>
                                        <Typography variant="body1" sx={{ mt: 1 }}>
                                            {yearEndViewDialog.action.rejectionNotes}
                                        </Typography>
                                    </Box>
                                </>
                            )}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setYearEndViewDialog({ open: false, action: null })}>Close</Button>
                </DialogActions>
            </Dialog>
            
            {/* Year-End Reject Dialog */}
            <Dialog open={yearEndRejectDialog.open} onClose={() => setYearEndRejectDialog({ open: false, action: null, notes: '' })}>
                <DialogTitle>Reject Year-End Action</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Rejection Notes"
                        value={yearEndRejectDialog.notes}
                        onChange={(e) => setYearEndRejectDialog({ ...yearEndRejectDialog, notes: e.target.value })}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setYearEndRejectDialog({ open: false, action: null, notes: '' })}>
                        Cancel
                    </Button>
                    <Button onClick={handleRejectYearEndAction} color="error" variant="contained">
                        Reject
                    </Button>
                </DialogActions>
            </Dialog>
            
            {/* Year-End Delete Confirmation Dialog */}
            <Dialog 
                open={yearEndDeleteDialog.open} 
                onClose={() => setYearEndDeleteDialog({ open: false, action: null, isApproved: false })} 
                fullWidth 
                maxWidth="sm"
            >
                <DialogTitle sx={{ color: '#d32f2f', fontWeight: 700 }}>
                    {yearEndDeleteDialog.isApproved ? 'Delete Approved Year-End Request' : 'Delete Year-End Request'}
                </DialogTitle>
                <DialogContent>
                    {yearEndDeleteDialog.action && (
                        <Box>
                            {yearEndDeleteDialog.isApproved ? (
                                <>
                                    <Alert severity="warning" sx={{ mb: 2, borderRadius: '8px' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                                            This will revert leave balance changes.
                                        </Typography>
                                        <Typography variant="body2">
                                            The leave balance adjustments made when this request was approved will be rolled back.
                                        </Typography>
                                    </Alert>
                                    <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                                            Request Details:
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Employee:</strong> {yearEndDeleteDialog.action.employee?.fullName || 'N/A'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Leave Type:</strong> {yearEndDeleteDialog.action.yearEndLeaveType || 'N/A'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Year:</strong> {yearEndDeleteDialog.action.yearEndYear || new Date().getFullYear()}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Days:</strong> {yearEndDeleteDialog.action.yearEndDays || 0}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Action:</strong> {yearEndDeleteDialog.action.yearEndSubType === 'CARRY_FORWARD' ? 'Carry Forward' : 'Encash'}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Are you sure you want to delete this approved request? This action cannot be undone.
                                    </Typography>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body2" sx={{ mb: 2 }}>
                                        Are you sure you want to delete this Year-End request?
                                    </Typography>
                                    <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: '8px' }}>
                                        <Typography variant="body2">
                                            <strong>Employee:</strong> {yearEndDeleteDialog.action.employee?.fullName || 'N/A'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Leave Type:</strong> {yearEndDeleteDialog.action.yearEndLeaveType || 'N/A'}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Days:</strong> {yearEndDeleteDialog.action.yearEndDays || 0}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        This action cannot be undone.
                                    </Typography>
                                </>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button 
                        onClick={() => setYearEndDeleteDialog({ open: false, action: null, isApproved: false })}
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={() => {
                            if (yearEndDeleteDialog.action?._id) {
                                handleDeleteYearEndAction(yearEndDeleteDialog.action._id, yearEndDeleteDialog.isApproved);
                            }
                        }}
                        color="error" 
                        variant="contained"
                    >
                        {yearEndDeleteDialog.isApproved ? 'Delete & Revert' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
            
            {/* Enhanced Leave Request Modal */}
            <EnhancedLeaveRequestModal
                open={viewDialog.open}
                onClose={() => setViewDialog({ open: false, request: null })}
                request={viewDialog.request}
                onStatusChange={handleStatusChange}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}><Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }} variant="filled">{snackbar.message}</Alert></Snackbar>

            {/* More Options Menu */}
            <Menu
                anchorEl={anchorEl}
                open={moreMenuOpen}
                onClose={handleMoreMenuClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <MenuItem onClick={handleLeavesTrackerClick}>
                    <ListItemIcon>
                        <AssessmentIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Leaves Tracker</ListItemText>
                </MenuItem>
            </Menu>
        </div>
    );
};

export default AdminLeavesPage;