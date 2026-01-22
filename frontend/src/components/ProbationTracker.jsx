// frontend/src/components/ProbationTracker.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Paper, Alert, Chip, Tooltip, IconButton, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Grid, Skeleton, Collapse } from '@mui/material';
import {
  Refresh,
  Warning,
  CheckCircle,
  Info,
  Search,
  FilterList,
  ExpandMore,
  ExpandLess,
  People,
  CalendarToday,
  Schedule,
  ErrorOutline
} from '@mui/icons-material';
import axios from '../api/axios';
import '../styles/ProbationTracker.css';

const ProbationTracker = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchProbationData();
  }, []);

  const fetchProbationData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('/analytics/probation-tracker');
      setEmployees(response.data.employees || []);
    } catch (err) {
      console.error('Error fetching probation tracker data:', err);
      setError(err.response?.data?.error || 'Failed to fetch probation tracker data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let totalOnProbation = employees.length;
    let endingThisMonth = 0;
    let extended = 0;
    let overdue = 0;

    employees.forEach(emp => {
      // Check if ending this month
      if (emp.finalProbationEndDate) {
        const endDate = new Date(emp.finalProbationEndDate + 'T00:00:00+05:30');
        if (endDate.getMonth() === currentMonth && endDate.getFullYear() === currentYear) {
          endingThisMonth++;
        }
      }

      // Check if extended (has leaves or absents)
      if ((emp.leaveExtensionDays > 0 || emp.absentExtensionDays > 0)) {
        extended++;
      }

      // Check if overdue
      if (emp.daysLeft < 0) {
        overdue++;
      }
    });

    return {
      totalOnProbation,
      endingThisMonth,
      extended,
      overdue
    };
  }, [employees]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Search filter
      const matchesSearch = !searchQuery || 
        emp.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase());

      // Department filter (if available in response)
      const matchesDepartment = !selectedDepartment || !emp.department || emp.department === selectedDepartment;

      // Status filter
      let matchesStatus = true;
      if (selectedStatus === 'on-track') {
        matchesStatus = emp.daysLeft >= 0 && emp.daysLeft > 7;
      } else if (selectedStatus === 'extended') {
        matchesStatus = (emp.leaveExtensionDays > 0 || emp.absentExtensionDays > 0);
      } else if (selectedStatus === 'overdue') {
        matchesStatus = emp.daysLeft < 0;
      } else if (selectedStatus === 'ending-soon') {
        matchesStatus = emp.daysLeft >= 0 && emp.daysLeft <= 7;
      }

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchQuery, selectedDepartment, selectedStatus]);

  // Paginated employees
  const paginatedEmployees = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredEmployees, page, rowsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, selectedDepartment, selectedStatus]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Format date to IST display (DD MMM YYYY)
  const formatDateIST = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr + 'T00:00:00+05:30');
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
    } catch (err) {
      return dateStr;
    }
  };

  // Format days left with status
  const getDaysLeftStatus = (daysLeft) => {
    if (daysLeft < 0) {
      return {
        label: `Overdue by ${Math.abs(daysLeft)} days`,
        color: 'error',
        variant: 'filled'
      };
    } else if (daysLeft === 0) {
      return {
        label: 'Ends Today',
        color: 'warning',
        variant: 'filled'
      };
    } else if (daysLeft <= 7) {
      return {
        label: `${daysLeft} days left`,
        color: 'warning',
        variant: 'outlined'
      };
    } else {
      return {
        label: `${daysLeft} days left`,
        color: 'success',
        variant: 'outlined'
      };
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (employeeId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedRows(newExpanded);
  };

  // Modern Summary Card Component
  const SummaryCard = ({ title, value, icon, accentColor = '#3B82F6' }) => (
    <Card
      sx={{
        borderRadius: '8px',
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          borderColor: '#D1D5DB'
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          backgroundColor: accentColor
        }
      }}
    >
      <CardContent sx={{ p: 3, pl: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1F2937', mb: 1 }}>
              {value}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', fontWeight: 500 }}>
              {title}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '8px',
              backgroundColor: `${accentColor}10`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accentColor,
              opacity: 0.7
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Loading skeleton
  if (loading) {
    return (
      <Box className="probation-tracker" sx={{ backgroundColor: '#F8FAFC', minHeight: '100vh' }}>
        {/* Sticky Header Skeleton */}
        <Box 
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            py: 3,
            px: 3,
            mb: 3
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Skeleton variant="text" width={200} height={40} sx={{ mb: 1 }} />
              <Skeleton variant="text" width={300} height={20} />
            </Box>
            <Skeleton variant="circular" width={48} height={48} />
          </Box>
        </Box>

        {/* Summary Cards Skeleton */}
        <Grid container spacing={3} sx={{ mb: 3, px: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card sx={{ borderRadius: '8px', backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width={60} height={32} sx={{ mb: 1 }} />
                      <Skeleton variant="text" width={120} height={16} />
                    </Box>
                    <Skeleton variant="circular" width={48} height={48} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Filters Bar Skeleton */}
        <Box sx={{ px: 3, mb: 3 }}>
          <Card sx={{ borderRadius: '8px', backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={3}>
                <Box display="flex" alignItems="center" gap={2} flex={1}>
                  <Skeleton variant="text" width={60} height={20} />
                  <Skeleton variant="rectangular" width={400} height={36} sx={{ borderRadius: '6px' }} />
                </Box>
                <Skeleton variant="rectangular" width={180} height={36} sx={{ borderRadius: '6px' }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Table Skeleton */}
        <Box sx={{ px: 3, mb: 3 }}>
          <Card sx={{ borderRadius: '8px', backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
            <CardContent sx={{ p: 0 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Box key={i} sx={{ p: 2, borderBottom: '1px solid #F3F4F6' }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width={200} height={16} sx={{ mb: 1 }} />
                      <Skeleton variant="text" width={100} height={12} />
                    </Box>
                    <Skeleton variant="text" width={100} height={16} />
                    <Skeleton variant="text" width={100} height={16} />
                    <Skeleton variant="text" width={100} height={16} />
                    <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: '12px' }} />
                    <Skeleton variant="text" width={60} height={16} />
                    <Skeleton variant="text" width={60} height={16} />
                    <Skeleton variant="circular" width={32} height={32} />
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box p={3}>
        <Alert 
          severity="error" 
          action={
            <IconButton 
              color="inherit" 
              size="small" 
              onClick={fetchProbationData}
              aria-label="retry"
            >
              <Refresh />
            </IconButton>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="probation-tracker" sx={{ backgroundColor: '#F8FAFC', minHeight: '100vh' }}>
      {/* Sticky Header */}
      <Box 
        className="page-header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          py: 3,
          px: 3,
          mb: 3
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1F2937', mb: 1 }}>
              Probation Tracker
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Monitor probation progress, extensions, and risks
            </Typography>
          </Box>
          <IconButton 
            onClick={fetchProbationData} 
            size="medium"
            sx={{ 
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              color: '#6B7280',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease',
              '&:hover': { 
                backgroundColor: '#F9FAFB',
                borderColor: '#D1D5DB',
                color: '#374151',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
              }
            }}
          >
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3, px: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Total on Probation"
            value={summaryMetrics.totalOnProbation}
            icon={<People />}
            accentColor="#3B82F6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Ending This Month"
            value={summaryMetrics.endingThisMonth}
            icon={<CalendarToday />}
            accentColor="#10B981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Extended"
            value={summaryMetrics.extended}
            icon={<Schedule />}
            accentColor="#F59E0B"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Overdue"
            value={summaryMetrics.overdue}
            icon={<ErrorOutline />}
            accentColor="#EF4444"
          />
        </Grid>
      </Grid>

      {/* Filters Bar */}
      <Box sx={{ px: 3, mb: 3 }}>
        <Box 
          sx={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            p: 3,
            borderBottom: '1px solid #E5E7EB'
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={3}>
            <Box display="flex" alignItems="center" gap={2} flex={1}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151' }}>
                Filters
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  maxWidth: 400,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#F9FAFB',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    '&:hover': {
                      borderColor: '#D1D5DB'
                    },
                    '&.Mui-focused': {
                      borderColor: '#3B82F6',
                      backgroundColor: 'white'
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" sx={{ color: '#6B7280' }} />
                    </InputAdornment>
                  )
                }}
              />
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel sx={{ color: '#6B7280' }}>Status</InputLabel>
                <Select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  label="Status"
                  sx={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#E5E7EB'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#D1D5DB'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3B82F6'
                    }
                  }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="on-track">On Track</MenuItem>
                  <MenuItem value="ending-soon">Ending Soon (≤7 days)</MenuItem>
                  <MenuItem value="extended">Extended</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                </Select>
              </FormControl>
              {(searchQuery || selectedStatus !== 'all') && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#3B82F6', 
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    '&:hover': { color: '#2563EB' }
                  }}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedStatus('all');
                  }}
                >
                  Clear Filters
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Empty State */}
      {filteredEmployees.length === 0 && !loading && (
        <Box sx={{ px: 3, mb: 3 }}>
          <Card sx={{ borderRadius: '8px', backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <People sx={{ fontSize: 64, color: '#9CA3AF', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#6B7280', mb: 1 }}>
                {employees.length === 0
                  ? 'No employees currently on probation'
                  : 'No employees found for the selected filters'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
                Try adjusting your search or filter criteria
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Table */}
      {filteredEmployees.length > 0 && (
        <Box sx={{ px: 3, mb: 3 }}>
          <Card sx={{ borderRadius: '8px', backgroundColor: 'white', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
            <TableContainer 
              component={Paper} 
              elevation={0}
              sx={{ 
                borderRadius: '8px',
                overflow: 'auto',
                maxHeight: 'calc(100vh - 500px)',
                '&::-webkit-scrollbar': {
                  width: '6px',
                  height: '6px'
                },
                '&::-webkit-scrollbar-track': {
                  background: '#F3F4F6',
                  borderRadius: '3px'
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#D1D5DB',
                  borderRadius: '3px',
                  '&:hover': {
                    background: '#9CA3AF'
                  }
                }
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      minWidth: 200, 
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Employee
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      minWidth: 120, 
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Joining Date
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      minWidth: 140, 
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Base End Date
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      minWidth: 140, 
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Final End Date
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      minWidth: 130, 
                      textAlign: 'center', 
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Days Left
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      minWidth: 120, 
                      textAlign: 'center', 
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Leave Ext.
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      minWidth: 120, 
                      textAlign: 'center', 
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Absent Ext.
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      width: 50, 
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      <Tooltip title="View details">
                        <Info fontSize="small" />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                {paginatedEmployees.map((emp, index) => {
                const isExpanded = expandedRows.has(emp.employeeId);
                const daysLeftStatus = getDaysLeftStatus(emp.daysLeft);
                const hasExtensions = (emp.leaveExtensionDays > 0 || emp.absentExtensionDays > 0);
                
                return (
                  <React.Fragment key={emp.employeeId}>
                    <TableRow
                      sx={{
                        '&:hover': { backgroundColor: '#F9FAFB' },
                        backgroundColor: emp.daysLeft < 0 ? '#FEF2F2' : index % 2 === 0 ? 'white' : '#FAFAFA',
                        cursor: 'pointer',
                        borderLeft: emp.daysLeft < 0 ? '3px solid #EF4444' : '3px solid transparent',
                        transition: 'all 0.2s ease',
                        borderBottom: '1px solid #F3F4F6'
                      }}
                      onClick={() => toggleRowExpansion(emp.employeeId)}
                    >
                      {/* Employee Info */}
                      <TableCell sx={{ py: 2 }}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              backgroundColor: '#F3F4F6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#6B7280',
                              fontWeight: 600,
                              fontSize: '0.875rem'
                            }}
                          >
                            {emp.employeeName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                              {emp.employeeName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6B7280' }}>
                              {emp.employeeCode}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Dates */}
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ color: '#374151' }}>
                          {formatDateIST(emp.joiningDate)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ color: '#374151' }}>
                          {formatDateIST(emp.baseProbationEndDate)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: hasExtensions ? 600 : 'normal',
                            color: hasExtensions ? '#DC2626' : '#374151'
                          }}
                        >
                          {formatDateIST(emp.finalProbationEndDate)}
                        </Typography>
                      </TableCell>

                      {/* Days Left */}
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            px: 2,
                            py: 1,
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: 
                              emp.daysLeft < 0 ? '#FEE2E2' :
                              emp.daysLeft <= 30 ? '#FEF3C7' :
                              emp.daysLeft <= 60 ? '#DBEAFE' :
                              '#D1FAE5',
                            color: 
                              emp.daysLeft < 0 ? '#DC2626' :
                              emp.daysLeft <= 30 ? '#D97706' :
                              emp.daysLeft <= 60 ? '#2563EB' :
                              '#059669'
                          }}
                        >
                          {emp.daysLeft < 0 
                            ? `${Math.abs(emp.daysLeft)} overdue`
                            : `${emp.daysLeft} days`
                          }
                        </Box>
                      </TableCell>

                      {/* Extensions */}
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Tooltip title="Leave extension days">
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                              {emp.leaveExtensionDays?.toFixed(1) || '0.0'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6B7280' }}>
                              days
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center" sx={{ py: 2 }}>
                        <Tooltip title="Absent extension days">
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                              {emp.absentExtensionDays?.toFixed(1) || '0.0'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6B7280' }}>
                              days
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>

                      {/* Expand Icon */}
                      <TableCell sx={{ py: 2 }}>
                        <IconButton 
                          size="small" 
                          sx={{ 
                            color: '#6B7280',
                            '&:hover': { backgroundColor: '#F3F4F6', color: '#374151' }
                          }}
                        >
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row - Details */}
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 0, backgroundColor: '#F9FAFB' }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 3 }}>
                            <Grid container spacing={3}>
                              {/* Leave Breakdown Card */}
                              <Grid item xs={12} md={6}>
                                <Card 
                                  sx={{
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    border: '1px solid #E5E7EB',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                                  }}
                                >
                                  <CardContent sx={{ p: 3 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#374151' }}>
                                      Leave Extensions
                                    </Typography>
                                    <Box display="flex" flexDirection="column" gap={2}>
                                      <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" sx={{ color: '#6B7280' }}>Full Day</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                                          {emp.fullDayLeaves || 0}
                                        </Typography>
                                      </Box>
                                      <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" sx={{ color: '#6B7280' }}>Half Day</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                                          {emp.halfDayLeaves || 0}
                                        </Typography>
                                      </Box>
                                      <Box 
                                        sx={{
                                          pt: 2,
                                          mt: 1,
                                          borderTop: '1px solid #E5E7EB'
                                        }}
                                      >
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151' }}>Total</Typography>
                                          <Typography 
                                            variant="h6" 
                                            sx={{ 
                                              fontWeight: 700, 
                                              color: '#3B82F6',
                                              backgroundColor: '#EFF6FF',
                                              px: 2,
                                              py: 1,
                                              borderRadius: '6px'
                                            }}
                                          >
                                            {emp.leaveExtensionDays?.toFixed(1) || '0.0'} days
                                          </Typography>
                                        </Box>
                                      </Box>
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                              
                              {/* Absent Breakdown Card */}
                              <Grid item xs={12} md={6}>
                                <Card 
                                  sx={{
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    border: '1px solid #E5E7EB',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                                  }}
                                >
                                  <CardContent sx={{ p: 3 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#374151' }}>
                                      Absence Extensions
                                    </Typography>
                                    <Box display="flex" flexDirection="column" gap={2}>
                                      <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" sx={{ color: '#6B7280' }}>Full Day</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                                          {emp.fullDayAbsents || 0}
                                        </Typography>
                                      </Box>
                                      <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" sx={{ color: '#6B7280' }}>Half Day</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                                          {emp.halfDayAbsents || 0}
                                        </Typography>
                                      </Box>
                                      <Box 
                                        sx={{
                                          pt: 2,
                                          mt: 1,
                                          borderTop: '1px solid #E5E7EB'
                                        }}
                                      >
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151' }}>Total</Typography>
                                          <Typography 
                                            variant="h6" 
                                            sx={{ 
                                              fontWeight: 700, 
                                              color: '#EF4444',
                                              backgroundColor: '#FEF2F2',
                                              px: 2,
                                              py: 1,
                                              borderRadius: '6px'
                                            }}
                                          >
                                            {emp.absentExtensionDays?.toFixed(1) || '0.0'} days
                                          </Typography>
                                        </Box>
                                      </Box>
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            </Grid>
                            <Box mt={3} p={2} sx={{ backgroundColor: '#F3F4F6', borderRadius: '6px' }}>
                              <Typography variant="caption" sx={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Info fontSize="inherit" sx={{ verticalAlign: 'middle' }} />
                                Probation end date calculated from joining date + 6 months + leave extensions + absent extensions
                              </Typography>
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredEmployees.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            sx={{
              borderTop: '1px solid #E5E7EB',
              backgroundColor: '#FAFAFA',
              '& .MuiTablePagination-toolbar': {
                padding: '16px'
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                color: '#374151',
                fontWeight: 500
              },
              '& .MuiIconButton-root': {
                color: '#6B7280',
                '&:hover': {
                  backgroundColor: '#F3F4F6',
                  color: '#374151'
                },
                '&.Mui-disabled': {
                  color: '#D1D5DB'
                }
              }
            }}
          />
          </Card>
        </Box>
      )}

    </Box>
  );
};

export default ProbationTracker;
