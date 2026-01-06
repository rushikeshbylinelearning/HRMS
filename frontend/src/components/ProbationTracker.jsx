// frontend/src/components/ProbationTracker.jsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Skeleton,
  Collapse
} from '@mui/material';
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

  // Summary Card Component with red theme
  const SummaryCard = ({ title, value, icon, color = '#c62828' }) => (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(198, 40, 40, 0.15)',
        border: '1px solid rgba(198, 40, 40, 0.2)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 4px 16px rgba(198, 40, 40, 0.25)',
          borderColor: 'rgba(198, 40, 40, 0.4)'
        },
        height: '100%',
        background: 'linear-gradient(135deg, #ffffff 0%, #fff5f5 100%)'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: '#666' }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '12px',
              backgroundColor: `${color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              border: `1px solid ${color}30`
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
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
        </Box>
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: '12px' }} />
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
            <IconButton color="inherit" size="small" onClick={fetchProbationData}>
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
    <Box className="probation-tracker" sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#c62828' }}>
          Probation Tracker
        </Typography>
        <IconButton 
          onClick={fetchProbationData} 
          size="small"
          sx={{ 
            color: '#c62828',
            '&:hover': { backgroundColor: 'rgba(198, 40, 40, 0.1)' }
          }}
        >
          <Refresh />
        </IconButton>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Total on Probation"
            value={summaryMetrics.totalOnProbation}
            icon={<People />}
            color="#c62828"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Ending This Month"
            value={summaryMetrics.endingThisMonth}
            icon={<CalendarToday />}
            color="#d32f2f"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Extended"
            value={summaryMetrics.extended}
            icon={<Schedule />}
            color="#e53935"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Overdue"
            value={summaryMetrics.overdue}
            icon={<ErrorOutline />}
            color="#b71c1c"
          />
        </Grid>
      </Grid>

      {/* Filters Row */}
      <Card sx={{ mb: 3, borderRadius: '12px', border: '1px solid rgba(198, 40, 40, 0.2)' }}>
        <CardContent sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <FilterList sx={{ color: '#c62828' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#c62828' }}>
                Filters
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              {filtersExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          <Collapse in={filtersExpanded}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="on-track">On Track</MenuItem>
                    <MenuItem value="ending-soon">Ending Soon (≤7 days)</MenuItem>
                    <MenuItem value="extended">Extended</MenuItem>
                    <MenuItem value="overdue">Overdue</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* Empty State */}
      {filteredEmployees.length === 0 && !loading && (
        <Card sx={{ borderRadius: '12px' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {employees.length === 0
                ? 'No employees currently on probation'
                : 'No employees match the selected filters'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {filteredEmployees.length > 0 && (
        <Card sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(198, 40, 40, 0.2)' }}>
          <TableContainer 
            component={Paper} 
            sx={{ 
              borderRadius: '12px', 
              overflow: 'auto',
              maxHeight: 'calc(100vh - 500px)',
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px'
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '4px'
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#c62828',
                borderRadius: '4px',
                '&:hover': {
                  background: '#b71c1c'
                }
              },
              '& .MuiTableHead-root': {
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: '#ffffff'
              }
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#ffffff', borderBottom: '2px solid #000000' }}>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold', minWidth: 200, borderBottom: '2px solid #000000' }}>
                    Employee
                  </TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold', minWidth: 120, borderBottom: '2px solid #000000' }}>
                    Joining Date
                  </TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold', minWidth: 140, borderBottom: '2px solid #000000' }}>
                    Base End Date
                  </TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold', minWidth: 140, borderBottom: '2px solid #000000' }}>
                    Final End Date
                  </TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold', minWidth: 130, textAlign: 'center', borderBottom: '2px solid #000000' }}>
                    Days Left
                  </TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold', minWidth: 120, textAlign: 'right', borderBottom: '2px solid #000000' }}>
                    Leave Ext.
                  </TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold', minWidth: 120, textAlign: 'right', borderBottom: '2px solid #000000' }}>
                    Absent Ext.
                  </TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold', width: 50, borderBottom: '2px solid #000000' }}>
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
                        '&:hover': { backgroundColor: '#fff5f5' },
                        backgroundColor: emp.daysLeft < 0 ? '#ffebee' : index % 2 === 0 ? 'white' : '#fffbfb',
                        cursor: 'pointer',
                        borderLeft: emp.daysLeft < 0 ? '3px solid #c62828' : '3px solid transparent',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => toggleRowExpansion(emp.employeeId)}
                    >
                      {/* Employee Info */}
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {emp.employeeName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {emp.employeeCode}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Dates */}
                      <TableCell>{formatDateIST(emp.joiningDate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateIST(emp.baseProbationEndDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: hasExtensions ? 600 : 'normal',
                            color: hasExtensions ? '#c62828' : 'inherit'
                          }}
                        >
                          {formatDateIST(emp.finalProbationEndDate)}
                        </Typography>
                      </TableCell>

                      {/* Days Left */}
                      <TableCell align="center">
                        <Chip
                          label={daysLeftStatus.label}
                          color={daysLeftStatus.color}
                          variant={daysLeftStatus.variant}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>

                      {/* Extensions */}
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {emp.leaveExtensionDays?.toFixed(1) || '0.0'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          days
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {emp.absentExtensionDays?.toFixed(1) || '0.0'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          days
                        </Typography>
                      </TableCell>

                      {/* Expand Icon */}
                      <TableCell>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row - Details */}
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 0, backgroundColor: '#f9f9f9' }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2 }}>
                            <Grid container spacing={3}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                  Leave Breakdown
                                </Typography>
                                <Box display="flex" gap={2} flexWrap="wrap">
                                  <Chip
                                    label={`Full Day: ${emp.fullDayLeaves || 0}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={`Half Day: ${emp.halfDayLeaves || 0}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={`Total: ${emp.leaveExtensionDays?.toFixed(1) || '0.0'} days`}
                                    size="small"
                                    color="primary"
                                  />
                                </Box>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                  Absent Breakdown
                                </Typography>
                                <Box display="flex" gap={2} flexWrap="wrap">
                                  <Chip
                                    label={`Full Day: ${emp.fullDayAbsents || 0}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={`Half Day: ${emp.halfDayAbsents || 0}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={`Total: ${emp.absentExtensionDays?.toFixed(1) || '0.0'} days`}
                                    size="small"
                                    color="error"
                                  />
                                </Box>
                              </Grid>
                            </Grid>
                            <Box mt={2} pt={2} borderTop="1px solid #e0e0e0">
                              <Typography variant="caption" color="text.secondary">
                                <Info fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
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
              borderTop: '1px solid rgba(198, 40, 40, 0.2)',
              '& .MuiTablePagination-toolbar': {
                backgroundColor: '#fffbfb'
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                color: '#c62828',
                fontWeight: 500
              },
              '& .MuiIconButton-root': {
                color: '#c62828',
                '&:hover': {
                  backgroundColor: 'rgba(198, 40, 40, 0.1)'
                },
                '&.Mui-disabled': {
                  color: 'rgba(198, 40, 40, 0.3)'
                }
              }
            }}
          />
        </Card>
      )}

    </Box>
  );
};

export default ProbationTracker;
