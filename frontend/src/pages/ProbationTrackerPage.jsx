import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  TableSortLabel
} from '@mui/material';
import {
  Search,
  People,
  School,
  Warning,
  CheckCircle
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import { formatDateIST } from '../utils/dateUtils';
import '../styles/ProbationTrackerPage.css';

const ProbationTrackerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [probationCalculations, setProbationCalculations] = useState([]);
  const [internshipCalculations, setInternshipCalculations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'daysLeft', direction: 'asc' });

  useEffect(() => {
    if (!user || !['Admin', 'HR'].includes(user.role)) {
      setError('Access denied. This page requires Admin or HR role.');
      setLoading(false);
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch employees, probation calculations, and internship calculations in parallel
      const [employeesResponse, probationResponse, internshipResponse] = await Promise.all([
        axios.get('/admin/employees?all=true'),
        axios.get('/admin/employees/probation/calculations'),
        axios.get('/admin/employees/internship/calculations')
      ]);
      
      const allEmployees = employeesResponse.data || [];
      const probationData = probationResponse.data?.calculations || [];
      const internshipData = internshipResponse.data?.calculations || [];
      
      // Filter employees (only active Probation or Intern)
      const filteredEmployees = allEmployees.filter(emp => {
        if (!emp.isActive) return false;
        if (!emp.employmentStatus) return false;
        const status = String(emp.employmentStatus).trim();
        return status === 'Probation' || status === 'Intern';
      });
      
      setEmployees(filteredEmployees);
      setProbationCalculations(probationData);
      setInternshipCalculations(internshipData);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch employee data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Merge employee data with calculation data
  const probationEmployeesWithCalculations = useMemo(() => {
    const probationEmployees = employees.filter(emp => {
      const status = emp.employmentStatus ? String(emp.employmentStatus).trim() : null;
      return status === 'Probation';
    });
    
    return probationEmployees.map(emp => {
      const calc = probationCalculations.find(c => c.employeeId === emp._id);
      return {
        ...emp,
        calculation: calc || null
      };
    });
  }, [employees, probationCalculations]);

  const internEmployeesWithCalculations = useMemo(() => {
    const internEmployees = employees.filter(emp => {
      const status = emp.employmentStatus ? String(emp.employmentStatus).trim() : null;
      return status === 'Intern';
    });
    
    return internEmployees.map(emp => {
      const calc = internshipCalculations.find(c => c.employeeId === emp._id);
      return {
        ...emp,
        calculation: calc || null
      };
    });
  }, [employees, internshipCalculations]);

  // Format date using IST-aware utility
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not Assigned';
    const formatted = formatDateIST(dateStr);
    return formatted === 'N/A' ? 'Not Assigned' : formatted;
  };

  // Format days left
  const formatDaysLeft = (daysLeft) => {
    if (daysLeft === null || daysLeft === undefined) return 'Not Assigned';
    if (daysLeft < 0) return 'Completed';
    return `${Math.ceil(daysLeft)} day${Math.ceil(daysLeft) !== 1 ? 's' : ''}`;
  };

  // Get status badge info
  const getStatusBadge = (daysLeft, status) => {
    // Use status from calculation if available, otherwise calculate
    if (status) {
      if (status === 'Not Assigned') {
        return { label: 'Not Assigned', color: '#6c757d', bgColor: '#e9ecef' };
      }
      if (status === 'Completed') {
        return { label: 'Completed', color: '#6c757d', bgColor: '#e9ecef' };
      }
      if (status === 'Critical') {
        return { label: 'Critical', color: '#dc3545', bgColor: '#f8d7da' };
      }
      if (status === 'Warning') {
        return { label: 'Warning', color: '#ffc107', bgColor: '#fff3cd' };
      }
      if (status === 'On Track') {
        return { label: 'On Track', color: '#28a745', bgColor: '#d4edda' };
      }
    }
    
    // Fallback calculation
    if (daysLeft === null || daysLeft === undefined) {
      return { label: 'Not Assigned', color: '#6c757d', bgColor: '#e9ecef' };
    }
    if (daysLeft < 0) {
      return { label: 'Completed', color: '#6c757d', bgColor: '#e9ecef' };
    }
    if (daysLeft <= 7) {
      return { label: 'Critical', color: '#dc3545', bgColor: '#f8d7da' };
    }
    if (daysLeft <= 15) {
      return { label: 'Warning', color: '#ffc107', bgColor: '#fff3cd' };
    }
    return { label: 'On Track', color: '#28a745', bgColor: '#d4edda' };
  };

  // Filter and search probation employees
  const filteredProbationEmployees = useMemo(() => {
    let filtered = probationEmployeesWithCalculations.filter(emp => {
      const searchLower = searchTerm.toLowerCase();
      return (
        emp.fullName?.toLowerCase().includes(searchLower) ||
        emp.employeeCode?.toLowerCase().includes(searchLower) ||
        emp.department?.toLowerCase().includes(searchLower)
      );
    });

    // Sort
    filtered.sort((a, b) => {
      const aDaysLeft = a.calculation?.daysLeft ?? null;
      const bDaysLeft = b.calculation?.daysLeft ?? null;
      
      if (aDaysLeft === null && bDaysLeft === null) return 0;
      if (aDaysLeft === null) return 1;
      if (bDaysLeft === null) return -1;
      
      return sortConfig.direction === 'asc' 
        ? aDaysLeft - bDaysLeft 
        : bDaysLeft - aDaysLeft;
    });

    return filtered;
  }, [probationEmployeesWithCalculations, searchTerm, sortConfig]);

  // Filter and search intern employees
  const filteredInternEmployees = useMemo(() => {
    let filtered = internEmployeesWithCalculations.filter(emp => {
      const searchLower = searchTerm.toLowerCase();
      return (
        emp.fullName?.toLowerCase().includes(searchLower) ||
        emp.employeeCode?.toLowerCase().includes(searchLower) ||
        emp.department?.toLowerCase().includes(searchLower)
      );
    });

    // Sort
    filtered.sort((a, b) => {
      const aDaysLeft = a.calculation?.daysLeft ?? null;
      const bDaysLeft = b.calculation?.daysLeft ?? null;
      
      if (aDaysLeft === null && bDaysLeft === null) return 0;
      if (aDaysLeft === null) return 1;
      if (bDaysLeft === null) return -1;
      
      return sortConfig.direction === 'asc' 
        ? aDaysLeft - bDaysLeft 
        : bDaysLeft - aDaysLeft;
    });

    return filtered;
  }, [internEmployeesWithCalculations, searchTerm, sortConfig]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const allRelevant = [...probationEmployeesWithCalculations, ...internEmployeesWithCalculations];
    const endingIn7Days = allRelevant.filter(emp => {
      const daysLeft = emp.calculation?.daysLeft ?? null;
      return daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
    }).length;
    
    const overdue = allRelevant.filter(emp => {
      const daysLeft = emp.calculation?.daysLeft ?? null;
      return daysLeft !== null && daysLeft < 0;
    }).length;

    return {
      onProbation: probationEmployeesWithCalculations.length,
      activeInterns: internEmployeesWithCalculations.length,
      endingIn7Days,
      overdue
    };
  }, [probationEmployeesWithCalculations, internEmployeesWithCalculations]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Safe number formatting with fallback
  const safeNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || isNaN(value)) return fallback;
    return typeof value === 'number' ? value : parseFloat(value) || fallback;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !employees.length) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box className="probation-tracker-page">
      {/* Header */}
      <Box className="probation-tracker-header">
        <Box>
          <Typography variant="h4" className="probation-tracker-title">
            Probation & Internship Tracker
          </Typography>
          <Typography variant="body1" className="probation-tracker-subtitle">
            Real-time probation and internship completion overview
          </Typography>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className="summary-card">
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Employees on Probation
                  </Typography>
                  <Typography variant="h4" className="summary-card-value">
                    {summaryStats.onProbation}
                  </Typography>
                </Box>
                <People sx={{ fontSize: 40, color: '#2C3E50', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="summary-card">
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Interns Active
                  </Typography>
                  <Typography variant="h4" className="summary-card-value">
                    {summaryStats.activeInterns}
                  </Typography>
                </Box>
                <School sx={{ fontSize: 40, color: '#2C3E50', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="summary-card summary-card-warning">
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Probation Ending in 7 Days
                  </Typography>
                  <Typography variant="h4" className="summary-card-value">
                    {summaryStats.endingIn7Days}
                  </Typography>
                </Box>
                <Warning sx={{ fontSize: 40, color: '#ffc107', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className="summary-card summary-card-completed">
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Overdue / Completed
                  </Typography>
                  <Typography variant="h4" className="summary-card-value">
                    {summaryStats.overdue}
                  </Typography>
                </Box>
                <CheckCircle sx={{ fontSize: 40, color: '#6c757d', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by name, employee ID, or department..."
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Employees on Probation Table */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
            Employees on Probation
          </Typography>
          {filteredProbationEmployees.length === 0 ? (
            <Alert severity="info">
              {searchTerm ? 'No employees found matching your search.' : 'No employees currently on probation.'}
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: '70vh', overflowX: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Employee ID</strong></TableCell>
                    <TableCell><strong>Employee Name</strong></TableCell>
                    <TableCell><strong>Department</strong></TableCell>
                    <TableCell><strong>Joining Date</strong></TableCell>
                    <TableCell><strong>Full Day Leave</strong></TableCell>
                    <TableCell><strong>Half Day Leave</strong></TableCell>
                    <TableCell><strong>Leave Extension (Days)</strong></TableCell>
                    <TableCell><strong>Company Holidays</strong></TableCell>
                    <TableCell><strong>Absent Days</strong></TableCell>
                    <TableCell><strong>Probation End Date</strong></TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortConfig.key === 'daysLeft'}
                        direction={sortConfig.key === 'daysLeft' ? sortConfig.direction : 'asc'}
                        onClick={() => handleSort('daysLeft')}
                      >
                        <strong>Days Left</strong>
                      </TableSortLabel>
                    </TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProbationEmployees.map((employee) => {
                    const calc = employee.calculation;
                    const daysLeft = calc?.daysLeft ?? null;
                    const statusBadge = getStatusBadge(daysLeft, calc?.status);
                    
                    return (
                      <TableRow key={employee._id} hover>
                        <TableCell>{employee.employeeCode || 'N/A'}</TableCell>
                        <TableCell>{employee.fullName || 'N/A'}</TableCell>
                        <TableCell>{employee.department || 'N/A'}</TableCell>
                        <TableCell>{formatDate(calc?.joiningDate || employee.joiningDate)}</TableCell>
                        <TableCell>{safeNumber(calc?.fullDayLeave, 0)}</TableCell>
                        <TableCell>{safeNumber(calc?.halfDayLeave, 0)}</TableCell>
                        <TableCell>{calc?.leaveExtensionDays ?? calc?.leaveExtensionDays === 0 ? calc.leaveExtensionDays.toFixed(1) : '0.0'}</TableCell>
                        <TableCell>{safeNumber(calc?.companyHolidays, 0)}</TableCell>
                        <TableCell>{calc?.absentDays ?? calc?.absentDays === 0 ? calc.absentDays.toFixed(1) : '0.0'}</TableCell>
                        <TableCell>{formatDate(calc?.tentativeEndDate)}</TableCell>
                        <TableCell>{formatDaysLeft(daysLeft)}</TableCell>
                        <TableCell>
                          <Chip
                            label={statusBadge.label}
                            size="small"
                            sx={{
                              backgroundColor: statusBadge.bgColor,
                              color: statusBadge.color,
                              fontWeight: 'bold'
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Interns Table */}
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
            Interns (Internship Tracker)
          </Typography>
          {filteredInternEmployees.length === 0 ? (
            <Alert severity="info">
              {searchTerm ? 'No interns found matching your search.' : 'No active interns found.'}
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: '70vh', overflowX: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Intern ID</strong></TableCell>
                    <TableCell><strong>Intern Name</strong></TableCell>
                    <TableCell><strong>Department</strong></TableCell>
                    <TableCell><strong>Internship Start Date</strong></TableCell>
                    <TableCell><strong>Full Day Leave</strong></TableCell>
                    <TableCell><strong>Half Day Leave</strong></TableCell>
                    <TableCell><strong>Leave Extension (Days)</strong></TableCell>
                    <TableCell><strong>Company Holidays</strong></TableCell>
                    <TableCell><strong>Absent Days</strong></TableCell>
                    <TableCell><strong>Internship End Date</strong></TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortConfig.key === 'daysLeft'}
                        direction={sortConfig.key === 'daysLeft' ? sortConfig.direction : 'asc'}
                        onClick={() => handleSort('daysLeft')}
                      >
                        <strong>Days Left</strong>
                      </TableSortLabel>
                    </TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInternEmployees.map((employee) => {
                    const calc = employee.calculation;
                    const daysLeft = calc?.daysLeft ?? null;
                    const statusBadge = getStatusBadge(daysLeft, calc?.status);
                    
                    return (
                      <TableRow key={employee._id} hover>
                        <TableCell>{employee.employeeCode || 'N/A'}</TableCell>
                        <TableCell>{employee.fullName || 'N/A'}</TableCell>
                        <TableCell>{employee.department || 'N/A'}</TableCell>
                        <TableCell>{formatDate(calc?.joiningDate || employee.joiningDate)}</TableCell>
                        <TableCell>{safeNumber(calc?.fullDayLeave, 0)}</TableCell>
                        <TableCell>{safeNumber(calc?.halfDayLeave, 0)}</TableCell>
                        <TableCell>{calc?.leaveExtensionDays ?? calc?.leaveExtensionDays === 0 ? calc.leaveExtensionDays.toFixed(1) : '0.0'}</TableCell>
                        <TableCell>{safeNumber(calc?.companyHolidays, 0)}</TableCell>
                        <TableCell>{calc?.absentDays ?? calc?.absentDays === 0 ? calc.absentDays.toFixed(1) : '0.0'}</TableCell>
                        <TableCell>{formatDate(calc?.internshipEndDate)}</TableCell>
                        <TableCell>{formatDaysLeft(daysLeft)}</TableCell>
                        <TableCell>
                          <Chip
                            label={statusBadge.label}
                            size="small"
                            sx={{
                              backgroundColor: statusBadge.bgColor,
                              color: statusBadge.color,
                              fontWeight: 'bold'
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProbationTrackerPage;
