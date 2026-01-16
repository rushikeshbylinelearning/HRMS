// src/pages/AdminLeavesPage.jsx
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import {
    Typography, Button, CircularProgress, Alert, Chip, Box, Snackbar, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Paper, Grid, Divider, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Tooltip, IconButton, Stack, TablePagination,
    Menu, MenuItem, ListItemIcon, ListItemText, Tabs, Tab, Switch, FormControlLabel, Skeleton,
    Card, CardContent, InputLabel, Select, FormControl, Avatar, Collapse
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EmailIcon from '@mui/icons-material/Email';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import CancelIcon from '@mui/icons-material/Cancel';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AdminLeaveForm from '../components/AdminLeaveForm';
import EnhancedLeaveRequestModal from '../components/EnhancedLeaveRequestModal';
import PageHeroHeader from '../components/PageHeroHeader';
import HolidayBulkUploadModal from '../components/HolidayBulkUploadModal';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import socket from '../socket';
import '../styles/AdminLeavesPage.css'; // Import the new stylesheet
import { TableSkeleton } from '../components/SkeletonLoaders';
import PeopleIcon from '@mui/icons-material/People';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WorkIcon from '@mui/icons-material/Work';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// --- Shared DatePicker SlotProps for Microsoft Calendar Style ---
const datePickerSlotProps = {
    textField: {
        fullWidth: true,
        size: 'medium',
        sx: {
            '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                bgcolor: '#fafafa',
                border: '1px solid #e0e0e0',
                transition: 'all 0.2s ease',
                '&:hover': {
                    bgcolor: '#f5f5f5',
                    borderColor: '#0078d4'
                },
                '&.Mui-focused': {
                    bgcolor: 'white',
                    borderColor: '#0078d4',
                    boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.1)'
                }
            },
            '& .MuiInputLabel-root': {
                color: '#605e5c',
                '&.Mui-focused': {
                    color: '#0078d4'
                }
            }
        }
    },
    paper: {
        sx: {
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            border: '1px solid #e0e0e0',
            overflow: 'hidden',
            bgcolor: 'white',
            zIndex: 1300,
            '& .MuiPickersCalendarHeader-root': {
                bgcolor: '#fafafa',
                borderBottom: '1px solid #e0e0e0',
                padding: '12px 16px',
                minHeight: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            },
            '& .MuiPickersCalendarHeader-labelContainer': {
                order: 2,
                '& .MuiPickersCalendarHeader-label': {
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#323130',
                    textTransform: 'none',
                    margin: 0,
                    cursor: 'pointer',
                    '&:hover': {
                        color: '#0078d4'
                    }
                }
            },
            '& .MuiPickersArrowSwitcher-root': {
                display: 'flex',
                gap: '4px',
                '& .MuiIconButton-root': {
                    color: '#605e5c',
                    padding: '8px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        bgcolor: '#f3f2f1'
                    }
                }
            },
            '& .MuiDayCalendar-header': {
                padding: '8px 0',
                bgcolor: 'white'
            },
            '& .MuiDayCalendar-weekContainer': {
                margin: 0
            },
            '& .MuiDayCalendar-weekDayLabel': {
                fontSize: '12px',
                fontWeight: 500,
                color: '#605e5c',
                width: '40px',
                height: '40px',
                margin: 0,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            },
            '& .MuiPickersDay-root': {
                width: '40px',
                height: '40px',
                fontSize: '14px',
                fontWeight: 400,
                color: '#323130',
                margin: 0,
                borderRadius: '50%',
                transition: 'all 0.2s ease',
                '&.Mui-selected': {
                    bgcolor: '#0078d4',
                    color: 'white',
                    fontWeight: 600,
                    border: 'none',
                    '&:hover': {
                        bgcolor: '#106ebe'
                    },
                    '&:focus': {
                        bgcolor: '#0078d4',
                        outline: 'none'
                    }
                },
                '&:hover': {
                    bgcolor: '#e1f5fe',
                    borderRadius: '50%'
                },
                '&.MuiPickersDay-today': {
                    border: 'none',
                    fontWeight: 600,
                    color: '#323130',
                    '&.Mui-selected': {
                        color: 'white',
                        bgcolor: '#0078d4'
                    },
                    '&:not(.Mui-selected)': {
                        color: '#0078d4'
                    }
                },
                '&.Mui-disabled': {
                    color: '#c8c6c4',
                    cursor: 'not-allowed'
                },
                '&.MuiPickersDay-dayOutsideMonth': {
                    color: '#c8c6c4'
                }
            },
            '& .MuiPickersMonth-root, & .MuiPickersYear-root': {
                fontSize: '14px',
                fontWeight: 400,
                color: '#323130',
                borderRadius: '4px',
                '&.Mui-selected': {
                    bgcolor: '#0078d4',
                    color: 'white',
                    fontWeight: 600,
                    '&:hover': {
                        bgcolor: '#106ebe'
                    }
                },
                '&:hover': {
                    bgcolor: '#e1f5fe'
                }
            }
        }
    },
    popper: {
        sx: {
            zIndex: 1300,
            '& .MuiPaper-root': {
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                border: '1px solid #e0e0e0'
            }
        },
        placement: 'bottom-start',
        modifiers: [
            {
                name: 'offset',
                options: {
                    offset: [0, 8]
                }
            }
        ]
    }
};

// --- Leave Count Summary Tab Component ---
const LeaveCountSummaryTab = memo(() => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [employees, setEmployees] = useState([]);
    const [allLeaveRequests, setAllLeaveRequests] = useState([]);
    const [analyticsData, setAnalyticsData] = useState({}); // Store analytics per employee
    const [totalWorkingDays, setTotalWorkingDays] = useState(null); // Total working days from monthly context settings
    const [monthlyContextDays, setMonthlyContextDays] = useState(30); // Monthly context days from settings
    const [filteredData, setFilteredData] = useState([]);
    
    // Filter states
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLeaveType, setSelectedLeaveType] = useState('');
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    
    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    
    // Clear all filters
    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedLeaveType('');
        setDateRange({ start: null, end: null });
        setSelectedMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    };
    
    // Check if any filters are active
    const hasActiveFilters = searchTerm || selectedLeaveType || dateRange.start || dateRange.end;
    
    // Fetch all data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch all employees
            const empRes = await api.get('/admin/employees?all=true');
            const allEmps = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.employees || []);
            // Filter for employees only (exclude interns)
            const employeesOnly = allEmps.filter(emp => emp.role !== 'Intern');
            setEmployees(employeesOnly);
            
            // Fetch all leave requests filtered by role at backend (employees only, exclude interns)
            // Backend handles the filtering, so we get optimized results
            let allLeaves = [];
            let page = 1;
            const limit = 1000; // Reasonable page size
            let hasMore = true;
            
            while (hasMore) {
                try {
                    // Pass role=Employee to backend for server-side filtering
                    const leavesRes = await api.get(`/admin/leaves/all?page=${page}&limit=${limit}&role=Employee`);
                    let pageLeaves = [];
                    if (leavesRes.data.requests) {
                        pageLeaves = Array.isArray(leavesRes.data.requests) ? leavesRes.data.requests : [];
                    } else {
                        pageLeaves = Array.isArray(leavesRes.data) ? leavesRes.data : [];
                    }
                    
                    allLeaves = [...allLeaves, ...pageLeaves];
                    
                    // Check if there are more pages
                    const totalCount = leavesRes.data.totalCount || 0;
                    const totalPages = leavesRes.data.totalPages || Math.ceil(totalCount / limit);
                    hasMore = page < totalPages && pageLeaves.length === limit;
                    page++;
                    
                    // Safety limit to prevent infinite loops
                    if (page > 100) {
                        console.warn('Reached safety limit for leave requests pagination');
                        break;
                    }
                } catch (pageErr) {
                    console.error('Error fetching leave requests page:', pageErr);
                    hasMore = false;
                }
            }
            
            setAllLeaveRequests(allLeaves);
        } catch (err) {
            console.error('Failed to fetch leave count data:', err);
            setError('Unable to load data');
        } finally {
            setLoading(false);
        }
    }, []);
    
    // Fetch actual worked days data using attendance summary API
    const fetchAnalyticsData = useCallback(async (startDate, endDate) => {
        try {
            // Convert date range to month/year format for the endpoint
            // Use the starting month of the date range
            const targetDate = new Date(startDate);
            const month = targetDate.getMonth() + 1; // API uses 1-12 format
            const year = targetDate.getFullYear();
            
            // Call the actual-work-days endpoint (returns data for all employees)
            const actualWorkDaysRes = await api.get('/attendance/actual-work-days', {
                params: {
                    month: month,
                    year: year
                }
            });
            
            // Create a set of employee IDs from the filtered employees list
            const employeeIdSet = new Set(employees.map(emp => emp._id?.toString()));
            
            // Extract actual worked days per employee (only include employees in our filtered list)
            const analyticsMap = {};
            
            const workDaysData = Array.isArray(actualWorkDaysRes.data) 
                ? actualWorkDaysRes.data 
                : [actualWorkDaysRes.data];
            
            workDaysData.forEach(item => {
                if (item && item.employeeId && item.actualWorkedDays !== undefined) {
                    // Only include employees that are in our filtered employees list
                    if (employeeIdSet.has(item.employeeId)) {
                        analyticsMap[item.employeeId] = {
                            actualWorkedDays: item.actualWorkedDays || 0
                        };
                    }
                }
            });
            
            setAnalyticsData(analyticsMap);
        } catch (err) {
            console.error('Failed to fetch actual worked days data:', err);
            // Don't set error - just log silently, show "unavailable" in UI
            setAnalyticsData({});
        }
    }, [employees]);
    
    // Fetch monthly context settings (single source of truth for working days)
    const fetchMonthlyContextSettings = useCallback(async () => {
        try {
            const response = await api.get('/analytics/monthly-context-settings');
            const days = response.data?.days || 30;
            setMonthlyContextDays(days);
            setTotalWorkingDays(days); // Use monthly context as total working days
        } catch (err) {
            console.error('Failed to fetch monthly context settings:', err);
            // Use default value
            setMonthlyContextDays(30);
            setTotalWorkingDays(30);
        }
    }, []);
    
    useEffect(() => {
        fetchData();
        fetchMonthlyContextSettings();
    }, [fetchData, fetchMonthlyContextSettings]);
    
    // Fetch analytics when date range changes
    useEffect(() => {
        if (loading || !employees.length) return;
        
        // Determine date range
        let startDate, endDate;
        if (dateRange.start && dateRange.end) {
            startDate = new Date(dateRange.start);
            endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Use selected month
            const year = selectedMonth.getFullYear();
            const month = selectedMonth.getMonth();
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        }
        
        // Fetch analytics data for working days
        fetchAnalyticsData(startDate, endDate);
    }, [selectedMonth, dateRange, employees.length, loading, fetchAnalyticsData]);
    
    // Aggregate and filter data
    useEffect(() => {
        if (loading || !employees.length) return;
        
        // Determine date range
        let startDate, endDate;
        if (dateRange.start && dateRange.end) {
            startDate = new Date(dateRange.start);
            endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Use selected month
            const year = selectedMonth.getFullYear();
            const month = selectedMonth.getMonth();
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        }
        
        // Aggregate leave data per employee
        // Note: Backend already filters by role, so allLeaveRequests only contains employee leaves
        const aggregated = employees.map(emp => {
            // Filter leaves for this employee within date range
            const empLeaves = allLeaveRequests.filter(leave => {
                // Match by employee ID (backend already filtered by role)
                const leaveEmployeeId = leave.employee?._id?.toString() || leave.employee?.toString();
                if (leaveEmployeeId !== emp._id?.toString()) return false;
                
                // Check if any leave date falls within range
                if (!leave.leaveDates || leave.leaveDates.length === 0) return false;
                
                const hasDateInRange = leave.leaveDates.some(date => {
                    const leaveDate = new Date(date);
                    return leaveDate >= startDate && leaveDate <= endDate;
                });
                
                if (!hasDateInRange) return false;
                
                // Filter by leave type if selected
                if (selectedLeaveType && leave.requestType !== selectedLeaveType) return false;
                
                return true;
            });
            
            // Calculate metrics
            const appliedCount = empLeaves.length;
            const approvedCount = empLeaves.filter(l => l.status === 'Approved').length;
            
            // Calculate total leave days (only approved)
            let totalLeaveDays = 0;
            const leaveTypeBreakdown = {};
            
            empLeaves.forEach(leave => {
                if (leave.status === 'Approved' && leave.leaveDates) {
                    // Count days within the date range
                    const daysInRange = leave.leaveDates.filter(date => {
                        const leaveDate = new Date(date);
                        return leaveDate >= startDate && leaveDate <= endDate;
                    }).length;
                    
                    // Adjust for half days
                    const multiplier = leave.leaveType === 'Full Day' ? 1 : 0.5;
                    const adjustedDays = daysInRange * multiplier;
                    totalLeaveDays += adjustedDays;
                    
                    // Track by request type
                    const reqType = leave.requestType || 'Unknown';
                    leaveTypeBreakdown[reqType] = (leaveTypeBreakdown[reqType] || 0) + adjustedDays;
                }
            });
            
            // Get working days from analytics API (not calculated on frontend)
            const empAnalytics = analyticsData[emp._id] || {};
            const totalWorkingDaysForPeriod = totalWorkingDays || monthlyContextDays; // From monthly context settings
            const actualWorkedDays = empAnalytics.actualWorkedDays || 0;
            
            // Format period display
            let periodDisplay;
            if (dateRange.start && dateRange.end) {
                const startStr = new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endStr = new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                periodDisplay = `${startStr} - ${endStr}`;
            } else {
                periodDisplay = `${selectedMonth.toLocaleString('default', { month: 'long' })} ${selectedMonth.getFullYear()}`;
            }
            
            return {
                employee: emp,
                leaveApplied: appliedCount,
                leaveApproved: approvedCount,
                totalLeaveDays: Math.round(totalLeaveDays * 10) / 10,
                leaveTypeBreakdown,
                totalWorkingDays: totalWorkingDaysForPeriod, // From backend calendar API
                actualWorkedDays: actualWorkedDays, // From backend attendance API
                month: periodDisplay
            };
        });
        
        // Apply search filter
        let filtered = aggregated;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = aggregated.filter(item => {
                const name = item.employee?.fullName?.toLowerCase() || '';
                const code = item.employee?.employeeCode?.toLowerCase() || '';
                return name.includes(searchLower) || code.includes(searchLower);
            });
        }
        
        setFilteredData(filtered);
    }, [employees, allLeaveRequests, selectedMonth, dateRange, searchTerm, selectedLeaveType, loading, analyticsData, totalWorkingDays, monthlyContextDays]);
    
    // Calculate KPIs
    const kpis = useMemo(() => {
        if (!filteredData.length) {
            return {
                totalEmployees: 0,
                leavesApplied: 0,
                leavesApproved: 0,
                totalLeaveDays: 0,
                avgWorkingDays: 0
            };
        }
        
        const totalEmployees = filteredData.length;
        const leavesApplied = filteredData.reduce((sum, item) => sum + item.leaveApplied, 0);
        const leavesApproved = filteredData.reduce((sum, item) => sum + item.leaveApproved, 0);
        const totalLeaveDays = filteredData.reduce((sum, item) => sum + item.totalLeaveDays, 0);
        const totalWorkedDays = filteredData.reduce((sum, item) => sum + item.actualWorkedDays, 0);
        const avgWorkingDays = totalWorkingDays || monthlyContextDays; // Use monthly context settings value
        
            return {
                totalEmployees,
                leavesApplied,
                leavesApproved,
                totalLeaveDays: Math.round(totalLeaveDays * 10) / 10,
                avgWorkingDays,
                totalWorkedDays
            };
    }, [filteredData]);
    
    // Paginated data
    const paginatedData = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);
    
    const handlePageChange = (event, newPage) => {
        setPage(newPage);
    };
    
    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    
    if (loading) {
        return (
            <Box>
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <Grid item xs={12} sm={6} md={2.4} key={i}>
                            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
            </Box>
        );
    }
    
    return (
        <Box>
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}
            
            {/* Filter Controls with KPI Cards */}
            <Paper 
                elevation={0} 
                sx={{ 
                    mb: 3, 
                    borderRadius: 3, 
                    border: '1px solid #e0e0e0',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
            >
                <Box 
                    sx={{
                        bgcolor: '#f8f9fa',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #e0e0e0',
                        cursor: 'pointer'
                    }}
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <FilterListIcon sx={{ color: '#dc3545' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                            Filters & Search
                        </Typography>
                        {hasActiveFilters && (
                            <Chip
                                label="Active"
                                size="small"
                                color="primary"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {hasActiveFilters && (
                            <Button
                                size="small"
                                startIcon={<ClearIcon />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearFilters();
                                }}
                                sx={{
                                    textTransform: 'none',
                                    color: '#dc3545',
                                    '&:hover': { bgcolor: 'rgba(220, 53, 69, 0.1)' }
                                }}
                            >
                                Clear All
                            </Button>
                        )}
                        <IconButton size="small">
                            {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Box>
                </Box>
                <Collapse in={filtersExpanded}>
                    <Box sx={{ p: 3, bgcolor: 'white' }}>
                        {/* KPI Cards Section */}
                        <Box sx={{ mb: 4 }}>
                            <Grid container spacing={2.5}>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(102, 126, 234, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <PeopleIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.totalEmployees}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Total Employees
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(240, 147, 251, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(240, 147, 251, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <EventBusyIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.leavesApplied}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Leaves Applied
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(79, 172, 254, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(79, 172, 254, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <CheckCircleIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.leavesApproved}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Leaves Approved
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(255, 152, 0, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #ff9800 0%, #ffeb3b 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(255, 152, 0, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <CalendarTodayIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.totalLeaveDays}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Total Leave Days
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(255, 106, 136, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #ff6a88 0%, #ff8c94 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(255, 106, 136, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <WorkIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.avgWorkingDays || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Total Working Days
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                        
                        <Divider sx={{ my: 3, borderColor: '#e0e0e0', borderWidth: 1 }} />
                        
                        <Grid container spacing={3}>
                            {/* Date Range Section */}
                            <Grid item xs={12}>
                                <Grid container spacing={2.5}>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <DatePicker
                                                label="Select Month"
                                                views={['year', 'month']}
                                                value={selectedMonth}
                                                onChange={(newValue) => {
                                                    if (newValue) {
                                                        setSelectedMonth(new Date(newValue.getFullYear(), newValue.getMonth(), 1));
                                                        setDateRange({ start: null, end: null });
                                                    }
                                                }}
                                                slotProps={datePickerSlotProps}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <DatePicker
                                                label="Custom Start Date"
                                                value={dateRange.start}
                                                onChange={(newValue) => setDateRange(prev => ({ ...prev, start: newValue }))}
                                                slotProps={datePickerSlotProps}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <DatePicker
                                                label="Custom End Date"
                                                value={dateRange.end}
                                                onChange={(newValue) => setDateRange(prev => ({ ...prev, end: newValue }))}
                                                slotProps={datePickerSlotProps}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                </Grid>
                            </Grid>
                            
                            <Divider sx={{ my: 3, borderColor: '#e0e0e0', borderWidth: 1 }} />
                            
                            {/* Search & Filter Section */}
                            <Grid item xs={12}>
                                <Typography variant="subtitle1" sx={{ mb: 2.5, fontWeight: 600, color: '#2c3e50', fontSize: '1.1rem' }}>
                                    🔍 Search & Filter
                                </Typography>
                                <Grid container spacing={2.5}>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <TextField
                                            fullWidth
                                            size="medium"
                                            label="Search Employee"
                                            placeholder="Name or Employee ID"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            InputProps={{
                                                startAdornment: <SearchIcon sx={{ mr: 1, color: '#dc3545' }} />
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '8px',
                                                    bgcolor: '#fafafa',
                                                    border: '1px solid #e0e0e0',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        bgcolor: '#f5f5f5',
                                                        borderColor: '#0078d4'
                                                    },
                                                    '&.Mui-focused': {
                                                        bgcolor: 'white',
                                                        borderColor: '#0078d4',
                                                        boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.1)'
                                                    }
                                                },
                                                '& .MuiInputLabel-root': {
                                                    color: '#605e5c',
                                                    '&.Mui-focused': {
                                                        color: '#0078d4'
                                                    }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <FormControl fullWidth size="medium">
                                            <InputLabel sx={{ 
                                                color: '#605e5c',
                                                '&.Mui-focused': {
                                                    color: '#0078d4'
                                                }
                                            }}>
                                                Leave Type
                                            </InputLabel>
                                            <Select
                                                value={selectedLeaveType}
                                                onChange={(e) => setSelectedLeaveType(e.target.value)}
                                                label="Leave Type"
                                                sx={{
                                                    borderRadius: '8px',
                                                    bgcolor: '#fafafa',
                                                    border: '1px solid #e0e0e0',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        bgcolor: '#f5f5f5',
                                                        borderColor: '#0078d4'
                                                    },
                                                    '&.Mui-focused': {
                                                        bgcolor: 'white',
                                                        borderColor: '#0078d4',
                                                        boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.1)'
                                                    },
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        border: 'none'
                                                    }
                                                }}
                                            >
                                                <MenuItem value="">All Types</MenuItem>
                                                <MenuItem value="Planned">Planned</MenuItem>
                                                <MenuItem value="Sick">Sick</MenuItem>
                                                <MenuItem value="Loss of Pay">Loss of Pay</MenuItem>
                                                <MenuItem value="Compensatory">Compensatory</MenuItem>
                                                <MenuItem value="Backdated Leave">Backdated Leave</MenuItem>
                                                <MenuItem value="Casual">Casual</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Box>
                </Collapse>
            </Paper>
            
            {/* Employee Leave List */}
            <div className="requests-card">
                <Paper 
                    elevation={0} 
                    sx={{ 
                        borderRadius: 0, 
                        overflow: 'hidden',
                        border: 'none',
                        boxShadow: 'none'
                    }}
                >
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderBottom: '1px solid #e0e0e0' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                            Employee Leave Summary
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {filteredData.length} employee{filteredData.length !== 1 ? 's' : ''} found
                        </Typography>
                    </Box>
                    <TableContainer component={Paper} elevation={0} className="table-container" sx={{ maxHeight: 'calc(100vh - 500px)', overflowX: 'hidden' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Employee Name
                                </TableCell>
                                <TableCell sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Employee ID
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Leave Applied
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Leave Approved
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Total Leave Days
                                </TableCell>
                                <TableCell sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Leave Type Breakdown
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Total Working Days
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Actual Worked Days
                                </TableCell>
                                <TableCell sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Month
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No data available for the selected period.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((item, index) => (
                                    <TableRow 
                                        key={item.employee._id || index} 
                                        hover
                                        sx={{
                                            '&:hover': {
                                                bgcolor: '#f8f9fa',
                                                transform: 'scale(1.001)',
                                                transition: 'all 0.2s ease'
                                            },
                                            '&:nth-of-type(even)': {
                                                bgcolor: '#fafafa'
                                            }
                                        }}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar 
                                                    sx={{ 
                                                        width: 40, 
                                                        height: 40,
                                                        bgcolor: '#dc3545',
                                                        fontWeight: 600,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    {item.employee.fullName?.charAt(0) || 'E'}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                                                        {item.employee.fullName || 'N/A'}
                                                    </Typography>
                                                    {item.employee.department && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.employee.department}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 500, color: '#666' }}>
                                                {item.employee.employeeCode || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip 
                                                label={item.leaveApplied} 
                                                size="small" 
                                                sx={{ 
                                                    bgcolor: '#fff3cd',
                                                    color: '#856404',
                                                    fontWeight: 600,
                                                    minWidth: 40
                                                }} 
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip 
                                                label={item.leaveApproved} 
                                                size="small" 
                                                sx={{ 
                                                    bgcolor: '#d4edda',
                                                    color: '#155724',
                                                    fontWeight: 600,
                                                    minWidth: 40
                                                }} 
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc3545', fontSize: '1rem' }}>
                                                {item.totalLeaveDays}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {Object.entries(item.leaveTypeBreakdown).map(([type, days]) => (
                                                    <Chip
                                                        key={type}
                                                        label={`${type}: ${days}`}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ 
                                                            fontSize: '0.7rem',
                                                            borderColor: '#dc3545',
                                                            color: '#dc3545',
                                                            '&:hover': {
                                                                bgcolor: '#dc3545',
                                                                color: 'white'
                                                            }
                                                        }}
                                                    />
                                                ))}
                                                {Object.keys(item.leaveTypeBreakdown).length === 0 && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                        None
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1976d2' }}>
                                                {item.totalWorkingDays !== null && item.totalWorkingDays !== undefined 
                                                    ? item.totalWorkingDays 
                                                    : 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                                                {item.actualWorkedDays || 0}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                {item.month}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        component="div"
                        count={filteredData.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handlePageChange}
                        onRowsPerPageChange={handleRowsPerPageChange}
                    />
                </Paper>
            </div>
        </Box>
    );
});

LeaveCountSummaryTab.displayName = 'LeaveCountSummaryTab';

// --- Intern Leave Count Summary Tab Component ---
const InternLeaveCountSummaryTab = memo(() => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [employees, setEmployees] = useState([]);
    const [allLeaveRequests, setAllLeaveRequests] = useState([]);
    const [analyticsData, setAnalyticsData] = useState({});
    const [totalWorkingDays, setTotalWorkingDays] = useState(null);
    const [monthlyContextDays, setMonthlyContextDays] = useState(30); // Monthly context days from settings
    const [filteredData, setFilteredData] = useState([]);
    
    // Filter states
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLeaveType, setSelectedLeaveType] = useState('');
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    
    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    
    // Clear all filters
    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedLeaveType('');
        setDateRange({ start: null, end: null });
        setSelectedMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    };
    
    // Check if any filters are active
    const hasActiveFilters = searchTerm || selectedLeaveType || dateRange.start || dateRange.end;
    
    // Fetch monthly context settings (single source of truth for working days)
    const fetchMonthlyContextSettings = useCallback(async () => {
        try {
            const response = await api.get('/analytics/monthly-context-settings');
            const days = response.data?.days || 30;
            setMonthlyContextDays(days);
            setTotalWorkingDays(days); // Use monthly context as total working days
        } catch (err) {
            console.error('Failed to fetch monthly context settings:', err);
            // Use default value
            setMonthlyContextDays(30);
            setTotalWorkingDays(30);
        }
    }, []);
    
    // Fetch all data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch all employees
            const empRes = await api.get('/admin/employees?all=true');
            const allEmps = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.employees || []);
            // Filter for interns only
            const interns = allEmps.filter(emp => emp.role === 'Intern');
            setEmployees(interns);
            
            // Fetch all leave requests filtered by role at backend (interns only)
            // Backend handles the filtering, so we get optimized results
            let allLeaves = [];
            let page = 1;
            const limit = 1000;
            let hasMore = true;
            
            while (hasMore) {
                try {
                    // Pass role=Intern to backend for server-side filtering
                    const leavesRes = await api.get(`/admin/leaves/all?page=${page}&limit=${limit}&role=Intern`);
                    let pageLeaves = [];
                    if (leavesRes.data.requests) {
                        pageLeaves = Array.isArray(leavesRes.data.requests) ? leavesRes.data.requests : [];
                    } else {
                        pageLeaves = Array.isArray(leavesRes.data) ? leavesRes.data : [];
                    }
                    
                    allLeaves = [...allLeaves, ...pageLeaves];
                    
                    const totalCount = leavesRes.data.totalCount || 0;
                    const totalPages = leavesRes.data.totalPages || Math.ceil(totalCount / limit);
                    hasMore = page < totalPages && pageLeaves.length === limit;
                    page++;
                    
                    if (page > 100) {
                        console.warn('Reached safety limit for leave requests pagination');
                        break;
                    }
                } catch (pageErr) {
                    console.error('Error fetching leave requests page:', pageErr);
                    hasMore = false;
                }
            }
            
            setAllLeaveRequests(allLeaves);
        } catch (err) {
            console.error('Failed to fetch intern leave count data:', err);
            setError('Unable to load data');
        } finally {
            setLoading(false);
        }
    }, []);
    
    // Fetch actual worked days data using attendance summary API
    const fetchAnalyticsData = useCallback(async (startDate, endDate) => {
        try {
            // Convert date range to month/year format for the endpoint
            // Use the starting month of the date range
            const targetDate = new Date(startDate);
            const month = targetDate.getMonth() + 1; // API uses 1-12 format
            const year = targetDate.getFullYear();
            
            // Call the actual-work-days endpoint (returns data for all employees)
            const actualWorkDaysRes = await api.get('/attendance/actual-work-days', {
                params: {
                    month: month,
                    year: year
                }
            });
            
            // Create a set of employee IDs from the filtered employees list (interns only)
            const employeeIdSet = new Set(employees.map(emp => emp._id?.toString()));
            
            // Extract actual worked days per employee (only include employees in our filtered list)
            const analyticsMap = {};
            
            const workDaysData = Array.isArray(actualWorkDaysRes.data) 
                ? actualWorkDaysRes.data 
                : [actualWorkDaysRes.data];
            
            workDaysData.forEach(item => {
                if (item && item.employeeId && item.actualWorkedDays !== undefined) {
                    // Only include employees that are in our filtered employees list (interns)
                    if (employeeIdSet.has(item.employeeId)) {
                        analyticsMap[item.employeeId] = {
                            actualWorkedDays: item.actualWorkedDays || 0
                        };
                    }
                }
            });
            
            setAnalyticsData(analyticsMap);
        } catch (err) {
            console.error('Failed to fetch actual worked days data:', err);
            setAnalyticsData({});
        }
    }, [employees]);
    
    useEffect(() => {
        fetchData();
        fetchMonthlyContextSettings();
    }, [fetchData, fetchMonthlyContextSettings]);
    
    // Fetch analytics when date range changes (for actual worked days per employee)
    useEffect(() => {
        if (loading || !employees.length) return;
        
        let startDate, endDate;
        if (dateRange.start && dateRange.end) {
            startDate = new Date(dateRange.start);
            endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const year = selectedMonth.getFullYear();
            const month = selectedMonth.getMonth();
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        }
        
        fetchAnalyticsData(startDate, endDate);
    }, [selectedMonth, dateRange, employees.length, loading, fetchAnalyticsData]);
    
    // Aggregate and filter data
    useEffect(() => {
        if (loading || !employees.length) return;
        
        let startDate, endDate;
        if (dateRange.start && dateRange.end) {
            startDate = new Date(dateRange.start);
            endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const year = selectedMonth.getFullYear();
            const month = selectedMonth.getMonth();
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        }
        
        // Aggregate leave data per employee
        // Note: Backend already filters by role, so allLeaveRequests only contains intern leaves
        const aggregated = employees.map(emp => {
            const empLeaves = allLeaveRequests.filter(leave => {
                // Match by employee ID (backend already filtered by role)
                const leaveEmployeeId = leave.employee?._id?.toString() || leave.employee?.toString();
                if (leaveEmployeeId !== emp._id?.toString()) return false;
                if (!leave.leaveDates || leave.leaveDates.length === 0) return false;
                
                const hasDateInRange = leave.leaveDates.some(date => {
                    const leaveDate = new Date(date);
                    return leaveDate >= startDate && leaveDate <= endDate;
                });
                
                if (!hasDateInRange) return false;
                if (selectedLeaveType && leave.requestType !== selectedLeaveType) return false;
                
                return true;
            });
            
            const appliedCount = empLeaves.length;
            const approvedCount = empLeaves.filter(l => l.status === 'Approved').length;
            
            let totalLeaveDays = 0;
            const leaveTypeBreakdown = {};
            
            empLeaves.forEach(leave => {
                if (leave.status === 'Approved' && leave.leaveDates) {
                    const daysInRange = leave.leaveDates.filter(date => {
                        const leaveDate = new Date(date);
                        return leaveDate >= startDate && leaveDate <= endDate;
                    }).length;
                    
                    const multiplier = leave.leaveType === 'Full Day' ? 1 : 0.5;
                    const adjustedDays = daysInRange * multiplier;
                    totalLeaveDays += adjustedDays;
                    
                    const reqType = leave.requestType || 'Unknown';
                    leaveTypeBreakdown[reqType] = (leaveTypeBreakdown[reqType] || 0) + adjustedDays;
                }
            });
            
            const empAnalytics = analyticsData[emp._id] || {};
            const totalWorkingDaysForPeriod = totalWorkingDays || monthlyContextDays; // From monthly context settings
            const actualWorkedDays = empAnalytics.actualWorkedDays || 0;
            
            let periodDisplay;
            if (dateRange.start && dateRange.end) {
                const startStr = new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endStr = new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                periodDisplay = `${startStr} - ${endStr}`;
            } else {
                periodDisplay = `${selectedMonth.toLocaleString('default', { month: 'long' })} ${selectedMonth.getFullYear()}`;
            }
            
            return {
                employee: emp,
                leaveApplied: appliedCount,
                leaveApproved: approvedCount,
                totalLeaveDays: Math.round(totalLeaveDays * 10) / 10,
                leaveTypeBreakdown,
                totalWorkingDays: totalWorkingDaysForPeriod,
                actualWorkedDays: actualWorkedDays,
                month: periodDisplay
            };
        });
        
        let filtered = aggregated;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = aggregated.filter(item => {
                const name = item.employee?.fullName?.toLowerCase() || '';
                const code = item.employee?.employeeCode?.toLowerCase() || '';
                return name.includes(searchLower) || code.includes(searchLower);
            });
        }
        
        setFilteredData(filtered);
    }, [employees, allLeaveRequests, selectedMonth, dateRange, searchTerm, selectedLeaveType, loading, analyticsData, totalWorkingDays, monthlyContextDays]);
    
    // Calculate KPIs
    const kpis = useMemo(() => {
        if (!filteredData.length) {
            return {
                totalEmployees: 0,
                leavesApplied: 0,
                leavesApproved: 0,
                totalLeaveDays: 0,
                avgWorkingDays: 0,
                totalWorkedDays: 0
            };
        }
        
        const totalEmployees = filteredData.length;
        const leavesApplied = filteredData.reduce((sum, item) => sum + item.leaveApplied, 0);
        const leavesApproved = filteredData.reduce((sum, item) => sum + item.leaveApproved, 0);
        const totalLeaveDays = filteredData.reduce((sum, item) => sum + item.totalLeaveDays, 0);
        const totalWorkedDays = filteredData.reduce((sum, item) => sum + item.actualWorkedDays, 0);
        const avgWorkingDays = totalWorkingDays || monthlyContextDays; // Use monthly context settings value
        
        return {
            totalEmployees,
            leavesApplied,
            leavesApproved,
            totalLeaveDays: Math.round(totalLeaveDays * 10) / 10,
            avgWorkingDays,
            totalWorkedDays
        };
    }, [filteredData, totalWorkingDays]);
    
    const paginatedData = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);
    
    const handlePageChange = (event, newPage) => {
        setPage(newPage);
    };
    
    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    
    if (loading) {
        return (
            <Box>
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <Grid item xs={12} sm={6} md={2.4} key={i}>
                            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
            </Box>
        );
    }
    
    return (
        <Box>
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}
            
            {/* Filter Controls with KPI Cards */}
            <Paper 
                elevation={0} 
                sx={{ 
                    mb: 3, 
                    borderRadius: 3, 
                    border: '1px solid #e0e0e0',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
            >
                <Box 
                    sx={{
                        bgcolor: '#f8f9fa',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #e0e0e0',
                        cursor: 'pointer'
                    }}
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <FilterListIcon sx={{ color: '#dc3545' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                            Filters & Search
                        </Typography>
                        {hasActiveFilters && (
                            <Chip
                                label="Active"
                                size="small"
                                color="primary"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {hasActiveFilters && (
                            <Button
                                size="small"
                                startIcon={<ClearIcon />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearFilters();
                                }}
                                sx={{
                                    textTransform: 'none',
                                    color: '#dc3545',
                                    '&:hover': { bgcolor: 'rgba(220, 53, 69, 0.1)' }
                                }}
                            >
                                Clear All
                            </Button>
                        )}
                        <IconButton size="small">
                            {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </Box>
                </Box>
                <Collapse in={filtersExpanded}>
                    <Box sx={{ p: 3, bgcolor: 'white' }}>
                        {/* KPI Cards Section */}
                        <Box sx={{ mb: 4 }}>
                            <Grid container spacing={2.5}>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(102, 126, 234, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <PeopleIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.totalEmployees}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Total Interns
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(240, 147, 251, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(240, 147, 251, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <EventBusyIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.leavesApplied}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Leaves Applied
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(79, 172, 254, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(79, 172, 254, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <CheckCircleIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.leavesApproved}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Leaves Approved
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(255, 152, 0, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #ff9800 0%, #ffeb3b 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(255, 152, 0, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <CalendarTodayIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.totalLeaveDays}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Total Leave Days
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6} md={2.4}>
                                    <Card 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: '0 4px 20px rgba(255, 106, 136, 0.15)', 
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #ff6a88 0%, #ff8c94 100%)',
                                            color: 'white',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 30px rgba(255, 106, 136, 0.25)'
                                            }
                                        }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                                <Box sx={{ 
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)', 
                                                    borderRadius: 2, 
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <WorkIcon sx={{ color: 'white', fontSize: 28 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'white' }}>
                                                {kpis.avgWorkingDays || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                                                Total Working Days
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>
                        
                        <Divider sx={{ my: 3, borderColor: '#e0e0e0', borderWidth: 1 }} />
                        
                        <Grid container spacing={3}>
                            {/* Date Range Section */}
                            <Grid item xs={12}>
                                <Grid container spacing={2.5}>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <DatePicker
                                                label="Select Month"
                                                views={['year', 'month']}
                                                value={selectedMonth}
                                                onChange={(newValue) => {
                                                    if (newValue) {
                                                        setSelectedMonth(new Date(newValue.getFullYear(), newValue.getMonth(), 1));
                                                        setDateRange({ start: null, end: null });
                                                    }
                                                }}
                                                slotProps={datePickerSlotProps}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <DatePicker
                                                label="Custom Start Date"
                                                value={dateRange.start}
                                                onChange={(newValue) => setDateRange(prev => ({ ...prev, start: newValue }))}
                                                slotProps={datePickerSlotProps}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <DatePicker
                                                label="Custom End Date"
                                                value={dateRange.end}
                                                onChange={(newValue) => setDateRange(prev => ({ ...prev, end: newValue }))}
                                                slotProps={datePickerSlotProps}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                </Grid>
                            </Grid>
                            
                            <Divider sx={{ my: 3, borderColor: '#e0e0e0', borderWidth: 1 }} />
                            
                            {/* Search & Filter Section */}
                            <Grid item xs={12}>
                                <Typography variant="subtitle1" sx={{ mb: 2.5, fontWeight: 600, color: '#2c3e50', fontSize: '1.1rem' }}>
                                    🔍 Search & Filter
                                </Typography>
                                <Grid container spacing={2.5}>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <TextField
                                            fullWidth
                                            size="medium"
                                            label="Search Intern"
                                            placeholder="Name or Intern ID"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            InputProps={{
                                                startAdornment: <SearchIcon sx={{ mr: 1, color: '#dc3545' }} />
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '8px',
                                                    bgcolor: '#fafafa',
                                                    border: '1px solid #e0e0e0',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        bgcolor: '#f5f5f5',
                                                        borderColor: '#0078d4'
                                                    },
                                                    '&.Mui-focused': {
                                                        bgcolor: 'white',
                                                        borderColor: '#0078d4',
                                                        boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.1)'
                                                    }
                                                },
                                                '& .MuiInputLabel-root': {
                                                    color: '#605e5c',
                                                    '&.Mui-focused': {
                                                        color: '#0078d4'
                                                    }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={4}>
                                        <FormControl fullWidth size="medium">
                                            <InputLabel sx={{ 
                                                color: '#605e5c',
                                                '&.Mui-focused': {
                                                    color: '#0078d4'
                                                }
                                            }}>
                                                Leave Type
                                            </InputLabel>
                                            <Select
                                                value={selectedLeaveType}
                                                onChange={(e) => setSelectedLeaveType(e.target.value)}
                                                label="Leave Type"
                                                sx={{
                                                    borderRadius: '8px',
                                                    bgcolor: '#fafafa',
                                                    border: '1px solid #e0e0e0',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        bgcolor: '#f5f5f5',
                                                        borderColor: '#0078d4'
                                                    },
                                                    '&.Mui-focused': {
                                                        bgcolor: 'white',
                                                        borderColor: '#0078d4',
                                                        boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.1)'
                                                    },
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        border: 'none'
                                                    }
                                                }}
                                            >
                                                <MenuItem value="">All Types</MenuItem>
                                                <MenuItem value="Planned">Planned</MenuItem>
                                                <MenuItem value="Sick">Sick</MenuItem>
                                                <MenuItem value="Loss of Pay">Loss of Pay</MenuItem>
                                                <MenuItem value="Compensatory">Compensatory</MenuItem>
                                                <MenuItem value="Backdated Leave">Backdated Leave</MenuItem>
                                                <MenuItem value="Casual">Casual</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Box>
                </Collapse>
            </Paper>
            
            {/* Intern Leave List */}
            <div className="requests-card">
                <Paper 
                    elevation={0} 
                    sx={{ 
                        borderRadius: 0, 
                        overflow: 'hidden',
                        border: 'none',
                        boxShadow: 'none'
                    }}
                >
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderBottom: '1px solid #e0e0e0' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                            Intern Leave Summary
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {filteredData.length} intern{filteredData.length !== 1 ? 's' : ''} found
                        </Typography>
                    </Box>
                    <TableContainer component={Paper} elevation={0} className="table-container" sx={{ maxHeight: 'calc(100vh - 500px)', overflowX: 'hidden' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Intern Name
                                </TableCell>
                                <TableCell sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Intern ID
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Leave Applied
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Leave Approved
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Total Leave Days
                                </TableCell>
                                <TableCell sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Leave Type Breakdown
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Total Working Days
                                </TableCell>
                                <TableCell align="center" sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Actual Worked Days
                                </TableCell>
                                <TableCell sx={{ 
                                    fontWeight: 700, 
                                    bgcolor: '#f8f9fa',
                                    color: '#2c3e50',
                                    fontSize: '0.875rem',
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Month
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No intern data available for the selected period.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((item, index) => (
                                    <TableRow 
                                        key={item.employee._id || index} 
                                        hover
                                        sx={{
                                            '&:hover': {
                                                bgcolor: '#f8f9fa',
                                                transform: 'scale(1.001)',
                                                transition: 'all 0.2s ease'
                                            },
                                            '&:nth-of-type(even)': {
                                                bgcolor: '#fafafa'
                                            }
                                        }}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar 
                                                    sx={{ 
                                                        width: 40, 
                                                        height: 40,
                                                        bgcolor: '#dc3545',
                                                        fontWeight: 600,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    {item.employee.fullName?.charAt(0) || 'I'}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                                                        {item.employee.fullName || 'N/A'}
                                                    </Typography>
                                                    {item.employee.department && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.employee.department}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 500, color: '#666' }}>
                                                {item.employee.employeeCode || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip 
                                                label={item.leaveApplied} 
                                                size="small" 
                                                sx={{ 
                                                    bgcolor: '#fff3cd',
                                                    color: '#856404',
                                                    fontWeight: 600,
                                                    minWidth: 40
                                                }} 
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip 
                                                label={item.leaveApproved} 
                                                size="small" 
                                                sx={{ 
                                                    bgcolor: '#d4edda',
                                                    color: '#155724',
                                                    fontWeight: 600,
                                                    minWidth: 40
                                                }} 
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc3545', fontSize: '1rem' }}>
                                                {item.totalLeaveDays}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {Object.entries(item.leaveTypeBreakdown).map(([type, days]) => (
                                                    <Chip
                                                        key={type}
                                                        label={`${type}: ${days}`}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ 
                                                            fontSize: '0.7rem',
                                                            borderColor: '#dc3545',
                                                            color: '#dc3545',
                                                            '&:hover': {
                                                                bgcolor: '#dc3545',
                                                                color: 'white'
                                                            }
                                                        }}
                                                    />
                                                ))}
                                                {Object.keys(item.leaveTypeBreakdown).length === 0 && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                        None
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1976d2' }}>
                                                {item.totalWorkingDays !== null && item.totalWorkingDays !== undefined 
                                                    ? item.totalWorkingDays 
                                                    : 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                                                {item.actualWorkedDays || 0}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                {item.month}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        component="div"
                        count={filteredData.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handlePageChange}
                        onRowsPerPageChange={handleRowsPerPageChange}
                    />
                </Paper>
            </div>
        </Box>
    );
});

InternLeaveCountSummaryTab.displayName = 'InternLeaveCountSummaryTab';

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
        <Dialog 
            open={open} 
            onClose={onClose} 
            fullWidth 
            maxWidth="sm"
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #E5E7EB',
                }
            }}
        >
            <DialogTitle sx={{
                backgroundColor: '#FFFFFF',
                borderBottom: '1px solid #E5E7EB',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <Box>
                    <Typography variant="h6" sx={{ color: '#111827', fontWeight: 600, fontSize: '1.125rem' }}>
                        Notification Recipients
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: '#6B7280',
                        '&:hover': {
                            backgroundColor: '#F3F4F6',
                            color: '#111827',
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ padding: '24px', backgroundColor: '#FFFFFF' }}>
                <Typography variant="body2" sx={{ color: '#6B7280', mb: 3 }}>
                    Add or remove email addresses that receive leave request notifications.
                </Typography>
                {loading ? <CircularProgress size={24} /> : (
                    <>
                        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs>
                                <TextField 
                                    label="Add new recipient email" 
                                    variant="outlined" 
                                    size="small" 
                                    fullWidth 
                                    value={newEmail} 
                                    onChange={(e) => setNewEmail(e.target.value)} 
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()} 
                                    sx={{
                                        '& .MuiInputLabel-root': {
                                            color: '#6B7280',
                                            fontSize: '0.875rem',
                                            '&.Mui-focused': {
                                                color: '#111827',
                                            },
                                        },
                                        '& .MuiOutlinedInput-root': {
                                            backgroundColor: '#FFFFFF',
                                            borderRadius: '8px',
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#D1D5DB',
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#9CA3AF',
                                            },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#111827',
                                                borderWidth: '1px',
                                            },
                                        },
                                    }}
                                />
                            </Grid>
                            <Grid item>
                                <Button 
                                    variant="contained" 
                                    onClick={handleAddEmail}
                                    sx={{
                                        backgroundColor: '#111827',
                                        color: '#FFFFFF',
                                        fontWeight: 600,
                                        borderRadius: '8px',
                                        textTransform: 'none',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            backgroundColor: '#1F2937',
                                        },
                                    }}
                                >
                                    Add
                                </Button>
                            </Grid>
                        </Grid>
                        <Divider sx={{ my: 3, borderColor: '#E5E7EB' }} />
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {emails.map((email) => (
                                <Chip
                                    key={email}
                                    label={email}
                                    onDelete={() => handleDeleteEmail(email)}
                                    deleteIcon={<CloseIcon sx={{ fontSize: '1rem' }} />}
                                    sx={{
                                        backgroundColor: '#F3F4F6',
                                        color: '#374151',
                                        borderRadius: '6px',
                                        border: '1px solid #E5E7EB',
                                        '& .MuiChip-deleteIcon': {
                                            color: '#9CA3AF',
                                            '&:hover': {
                                                color: '#374151',
                                            },
                                        },
                                    }}
                                />
                            ))}
                        </Box>
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{
                padding: '16px 24px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #E5E7EB',
            }}>
                <Button 
                    onClick={onClose}
                    variant="outlined"
                    sx={{
                        borderColor: '#D1D5DB',
                        color: '#374151',
                        fontWeight: 600,
                        borderRadius: '8px',
                        textTransform: 'none',
                        '&:hover': {
                            borderColor: '#9CA3AF',
                            backgroundColor: '#F9FAFB',
                        },
                    }}
                >
                    Close
                </Button>
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
    const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

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
                
                {/* Bulk Upload Button */}
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        onClick={() => setBulkUploadOpen(true)}
                        sx={{ mr: 1 }}
                    >
                        Upload Holidays (Excel)
                    </Button>
                </Box>
                
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
                        holidays.map(h => {
                            const isTentative = !h.date || h.isTentative;
                            const dateDisplay = isTentative ? 'Tentative' : new Date(h.date).toLocaleDateString();
                            return (
                                <Chip 
                                    key={h._id} 
                                    label={`${h.name} (${dateDisplay})`}
                                    onDelete={() => handleDeleteHoliday(h._id)}
                                    color={isTentative ? 'warning' : 'default'}
                                />
                            );
                        })
                    ) : (
                        <div className="no-recipients-box"><InfoOutlinedIcon fontSize="small" /><Typography variant="body2">No holidays configured.</Typography></div>
                    )}
                </div>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
            
            {/* Bulk Upload Modal */}
            <HolidayBulkUploadModal 
                open={bulkUploadOpen} 
                onClose={() => setBulkUploadOpen(false)}
                onSuccess={() => {
                    setBulkUploadOpen(false);
                    fetchHolidays();
                }}
            />
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
                    {request.status === 'Pending' && (
                        <Tooltip title="Reject">
                            <IconButton 
                                size="small" 
                                color="error"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusChange(request._id, 'Rejected', '');
                                }}
                            >
                                <CancelIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
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
    const fetchInitialDataRef = useRef(null);

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

    // Keep ref updated with latest fetchInitialData
    fetchInitialDataRef.current = fetchInitialData;
    
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
        } else if (tab === 'leave-count') {
            setCurrentTab(2);
        } else if (tab === 'intern-leave-count') {
            setCurrentTab(3);
        }
    }, [searchParams, setSearchParams, fetchYearEndActions, yearEndActions.length]);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
    
    // POLLING REMOVED: Socket events + visibility change provide real-time updates
    useEffect(() => {
        if (!socket) return;

        // Listen for leave request updates (if backend emits this event)
        const handleLeaveUpdate = () => {
            console.log('[AdminLeavesPage] Received leave update event, refreshing data');
            if (fetchInitialDataRef.current) {
                fetchInitialDataRef.current();
            }
        };

        // Try to listen for leave_request_updated (may not exist yet)
        socket.on('leave_request_updated', handleLeaveUpdate);
        socket.on('attendance_log_updated', handleLeaveUpdate); // Also listen for attendance updates

        // Fallback: Refresh on visibility change (socket disconnect recovery + user returns to page)
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // Always refresh when page becomes visible (user returns to tab)
                if (fetchInitialDataRef.current) {
                    fetchInitialDataRef.current();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            socket.off('leave_request_updated', handleLeaveUpdate);
            socket.off('attendance_log_updated', handleLeaveUpdate);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []); // Empty deps - listeners registered once, use ref for latest callback

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
                    <Tab label="Employee Leave Count" />
                    <Tab label="Intern Leave Count" />
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
                
                {/* Leave Count Summary Tab - Always mounted, visibility toggled */}
                <Box
                    sx={{
                        position: currentTab === 2 ? 'relative' : 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        opacity: currentTab === 2 ? 1 : 0,
                        transform: currentTab === 2 ? 'translateY(0)' : 'translateY(8px)',
                        pointerEvents: currentTab === 2 ? 'auto' : 'none',
                        transition: 'opacity 220ms ease-in-out, transform 220ms ease-in-out',
                        willChange: currentTab === 2 ? 'auto' : 'opacity, transform',
                        zIndex: currentTab === 2 ? 1 : 0,
                        visibility: currentTab === 2 ? 'visible' : 'hidden',
                    }}
                >
                    <LeaveCountSummaryTab />
                </Box>
                
                {/* Intern Leave Count Summary Tab - Always mounted, visibility toggled */}
                <Box
                    sx={{
                        position: currentTab === 3 ? 'relative' : 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        opacity: currentTab === 3 ? 1 : 0,
                        transform: currentTab === 3 ? 'translateY(0)' : 'translateY(8px)',
                        pointerEvents: currentTab === 3 ? 'auto' : 'none',
                        transition: 'opacity 220ms ease-in-out, transform 220ms ease-in-out',
                        willChange: currentTab === 3 ? 'auto' : 'opacity, transform',
                        zIndex: currentTab === 3 ? 1 : 0,
                        visibility: currentTab === 3 ? 'visible' : 'hidden',
                    }}
                >
                    <InternLeaveCountSummaryTab />
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