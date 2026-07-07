// frontend/src/components/payroll/EmployeeSalaryDetail.jsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Grid, Paper, Chip, IconButton, Divider, Alert, Select, MenuItem, FormControl, InputLabel, Card, CardContent, CardHeader, Avatar, LinearProgress } from '@mui/material';
import {
  Close,
  CalendarToday,
  AttachMoney,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Cancel,
  Schedule,
  Person,
  Work,
  AccessTime,
  MonetizationOn
} from '@mui/icons-material';
import axios from '../../api/axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { SkeletonBox } from '../SkeletonLoaders';
const EmployeeSalaryDetail = ({ open, onClose, employee, settings }) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [salaryBreakdown, setSalaryBreakdown] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && employee) {
      fetchEmployeeAttendance();
    }
  }, [open, employee, selectedMonth, selectedYear]);

  const fetchEmployeeAttendance = async () => {
    if (!employee) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Fetch attendance data for the employee
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      
      const response = await axios.get(`/admin/attendance/user/${employee.id}`, {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      });
      
      const attendanceLogs = response.data || [];
      
      // Transform the API response to match our expected format
      const transformedAttendance = attendanceLogs.map(log => {
        const sessions = log.sessions || [];
        const workingHours = sessions.reduce((total, session) => {
          if (session.startTime && session.endTime) {
            const duration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60);
            return total + duration;
          }
          return total;
        }, 0);
        
        // Determine status based on log data
        let status = 'absent';
        if (log.status === 'present' || log.clockInTime) {
          status = 'present';
        } else if (log.status === 'half-day') {
          status = 'half-day';
        } else if (log.status === 'late') {
          status = 'late';
        }
        
        return {
          date: log.attendanceDate,
          status: status,
          workingHours: Math.round(workingHours * 10) / 10,
          overtimeHours: workingHours > 8 ? Math.round((workingHours - 8) * 10) / 10 : 0,
          isHoliday: false,
          isLeave: log.status === 'leave' || log.status === 'absent'
        };
      });
      
      // Fill in all days of the month
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const allDaysData = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(selectedYear, selectedMonth - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        
        // Find existing attendance record
        const existingRecord = transformedAttendance.find(rec => rec.date === dateStr);
        
        if (existingRecord) {
          allDaysData.push(existingRecord);
        } else {
          // No attendance record - mark as absent (unless it's Sunday)
          allDaysData.push({
            date: dateStr,
            status: dayOfWeek === 0 ? 'holiday' : 'absent',
            workingHours: 0,
            overtimeHours: 0,
            isHoliday: dayOfWeek === 0,
            isLeave: false
          });
        }
      }
      
      setAttendanceData(allDaysData);
      calculateSalaryBreakdown(allDaysData);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setError('Failed to fetch attendance data');
      // Generate mock data for demonstration
      generateMockAttendanceData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockAttendanceData = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const mockData = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth - 1, day);
      const dayOfWeek = date.getDay();
      
      // Skip Sundays
      if (dayOfWeek === 0) continue;
      
      // Mock attendance status
      let status = 'present';
      if (Math.random() < 0.1) status = 'absent';
      else if (Math.random() < 0.05) status = 'half-day';
      else if (Math.random() < 0.15) status = 'late';
      
      mockData.push({
        date: date.toISOString().split('T')[0],
        status,
        workingHours: status === 'present' ? 8 : status === 'half-day' ? 4 : 0,
        overtimeHours: status === 'present' && Math.random() < 0.2 ? Math.floor(Math.random() * 3) : 0,
        isHoliday: false,
        isLeave: status === 'absent' && Math.random() < 0.5
      });
    }
    
    setAttendanceData(mockData);
    calculateSalaryBreakdown(mockData);
  };

  const calculateSalaryBreakdown = (attendance) => {
    if (!employee || !settings) return;

    const dailySalary = employee.netPay / 30; // Assuming 30 working days
    const hourlyRate = dailySalary / 8;
    const overtimeRate = settings.overtimeRate || 0; // Use settings overtime rate or default to 0
    
    let totalPresentDays = 0;
    let totalHalfDays = 0;
    let totalAbsentDays = 0;
    let totalOvertimeHours = 0;
    let totalWorkingHours = 0;
    let totalSalary = 0;
    let totalDeductions = 0;

    const dayWiseBreakdown = attendance.map(day => {
      let daySalary = 0;
      let dayDeduction = 0;
      let statusColor = 'default';
      let statusIcon = null;

      switch (day.status) {
        case 'present':
          daySalary = dailySalary;
          totalPresentDays++;
          totalWorkingHours += day.workingHours;
          statusColor = 'success';
          statusIcon = <CheckCircle />;
          break;
        case 'half-day':
          daySalary = dailySalary / 2;
          dayDeduction = dailySalary / 2;
          totalHalfDays++;
          totalWorkingHours += day.workingHours;
          statusColor = 'warning';
          statusIcon = <Schedule />;
          break;
        case 'holiday':
          daySalary = 0;
          dayDeduction = 0; // No deduction for holidays
          statusColor = 'default';
          statusIcon = <Cancel />;
          break;
        case 'absent':
          daySalary = 0;
          dayDeduction = dailySalary;
          totalAbsentDays++;
          statusColor = 'error';
          statusIcon = <Cancel />;
          break;
        case 'late':
          daySalary = dailySalary * 0.9; // 10% deduction for late
          dayDeduction = dailySalary * 0.1;
          totalPresentDays++;
          totalWorkingHours += day.workingHours;
          statusColor = 'warning';
          statusIcon = <TrendingDown />;
          break;
      }

      // Add overtime
      if (day.overtimeHours > 0) {
        const overtimePay = day.overtimeHours * overtimeRate;
        daySalary += overtimePay;
        totalOvertimeHours += day.overtimeHours;
      }

      totalSalary += daySalary;
      totalDeductions += dayDeduction;

      return {
        ...day,
        daySalary: Math.round(daySalary),
        dayDeduction: Math.round(dayDeduction),
        statusColor,
        statusIcon
      };
    });

    setSalaryBreakdown({
      dayWiseBreakdown,
      summary: {
        totalPresentDays,
        totalHalfDays,
        totalAbsentDays,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        totalWorkingHours,
        totalSalary: Math.round(totalSalary),
        totalDeductions: Math.round(totalDeductions),
        netSalary: Math.round(totalSalary - totalDeductions)
      }
    });
  };

  const getStatusChip = (day) => {
    const statusConfig = {
      present: { label: 'Present', color: 'success', icon: <CheckCircle /> },
      'half-day': { label: 'Half Day', color: 'warning', icon: <Schedule /> },
      holiday: { label: 'Holiday', color: 'default', icon: <CalendarToday /> },
      absent: { label: 'Absent', color: 'error', icon: <Cancel /> },
      late: { label: 'Late', color: 'warning', icon: <TrendingDown /> }
    };

    const config = statusConfig[day.status] || statusConfig.absent;
    
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        sx={{ minWidth: 100 }}
      />
    );
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const generatePayslip = async () => {
    if (!salaryBreakdown) return;
    
    try {
      // Create a new PDF document
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Company Header
      pdf.setFillColor(229, 57, 53); // Red color
      pdf.rect(0, 0, pageWidth, 30, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PAYSLIP', pageWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.text('Attendance Management System', pageWidth / 2, 22, { align: 'center' });
      
      // Employee Details
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Employee Details', 20, 50);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Name: ${employee.name}`, 20, 60);
      pdf.text(`Department: ${employee.department}`, 20, 67);
      pdf.text(`Designation: ${employee.designation}`, 20, 74);
      pdf.text(`Email: ${employee.email}`, 20, 81);
      
      // Period
      const periodText = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-IN', { 
        month: 'long', 
        year: 'numeric' 
      });
      pdf.text(`Period: ${periodText}`, pageWidth - 20, 60, { align: 'right' });
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 20, 67, { align: 'right' });
      
      // Summary Section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Monthly Summary', 20, 100);
      
      // Summary table
      const summaryY = 110;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      pdf.text('Present Days:', 20, summaryY);
      pdf.text(`${salaryBreakdown.summary.totalPresentDays}`, 60, summaryY);
      
      pdf.text('Half Days:', 20, summaryY + 7);
      pdf.text(`${salaryBreakdown.summary.totalHalfDays}`, 60, summaryY + 7);
      
      pdf.text('Absent Days:', 20, summaryY + 14);
      pdf.text(`${salaryBreakdown.summary.totalAbsentDays}`, 60, summaryY + 14);
      
      pdf.text('Overtime Hours:', 20, summaryY + 21);
      pdf.text(`${salaryBreakdown.summary.totalOvertimeHours}h`, 60, summaryY + 21);
      
      // Salary Details
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Salary Details', 20, summaryY + 40);
      
      const salaryY = summaryY + 50;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      pdf.text('Gross Salary:', 20, salaryY);
      pdf.text(`₹${salaryBreakdown.summary.totalSalary.toLocaleString('en-IN')}`, 80, salaryY);
      
      pdf.text('Total Deductions:', 20, salaryY + 7);
      pdf.text(`₹${salaryBreakdown.summary.totalDeductions.toLocaleString('en-IN')}`, 80, salaryY + 7);
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Net Salary:', 20, salaryY + 20);
      pdf.text(`₹${salaryBreakdown.summary.netSalary.toLocaleString('en-IN')}`, 80, salaryY + 20);
      
      // Footer
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(128, 128, 128);
      pdf.text('This is a computer generated payslip. No signature required.', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Save the PDF
      const fileName = `Payslip_${employee.name.replace(/\s+/g, '_')}_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating payslip:', error);
      alert('Error generating payslip. Please try again.');
    }
  };

  if (!employee) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: '16px', 
          height: 'calc(100vh - 40px)',
          width: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 40px)',
          maxWidth: 'calc(100vw - 40px)',
          background: '#ffffff',
          margin: '20px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)'
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #2C3E50 0%, #34495e 100%)',
        color: 'white',
        padding: '24px',
        borderRadius: '16px 16px 0px 0px'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
              <Person sx={{ fontSize: 32 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {employee.name}
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {employee.department} • {employee.designation}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-IN', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </Typography>
            </Box>
          </Box>
          
          {/* Month and Year Selectors */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150, bgcolor: 'white', borderRadius: '8px' }}>
              <InputLabel>Month</InputLabel>
              <Select
                value={selectedMonth}
                label="Month"
                onChange={(e) => setSelectedMonth(e.target.value)}
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value={1}>January</MenuItem>
                <MenuItem value={2}>February</MenuItem>
                <MenuItem value={3}>March</MenuItem>
                <MenuItem value={4}>April</MenuItem>
                <MenuItem value={5}>May</MenuItem>
                <MenuItem value={6}>June</MenuItem>
                <MenuItem value={7}>July</MenuItem>
                <MenuItem value={8}>August</MenuItem>
                <MenuItem value={9}>September</MenuItem>
                <MenuItem value={10}>October</MenuItem>
                <MenuItem value={11}>November</MenuItem>
                <MenuItem value={12}>December</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120, bgcolor: 'white', borderRadius: '8px' }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                label="Year"
                onChange={(e) => setSelectedYear(e.target.value)}
                sx={{ borderRadius: '8px' }}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return <MenuItem key={year} value={year}>{year}</MenuItem>;
                })}
              </Select>
            </FormControl>
          </Box>
          
          <IconButton onClick={onClose} size="large" sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <SkeletonBox width="60px" height="60px" borderRadius="50%" />
            <Typography variant="h6" sx={{ color: '#666' }}>Loading attendance data...</Typography>
            <LinearProgress sx={{ width: '200px', mt: 2, borderRadius: '4px' }} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 3, borderRadius: '12px' }}>
            {error}
          </Alert>
        ) : (
          <Box>
            {/* Enhanced Summary Cards */}
            {salaryBreakdown && (
              <Box sx={{ p: 3, background: '#ffffff' }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)',
                      color: '#2e7d32',
                      borderRadius: '16px',
                      boxShadow: '0 4px 16px rgba(76, 175, 80, 0.15)',
                      transition: 'transform 0.3s ease',
                      border: '1px solid #c8e6c9',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}>
                      <CardContent sx={{ textAlign: 'center', p: 3 }}>
                        <CheckCircle sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {salaryBreakdown.summary.totalPresentDays}
                        </Typography>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Present Days
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #fff3e0 0%, #fff8e1 100%)',
                      color: '#ef6c00',
                      borderRadius: '16px',
                      boxShadow: '0 4px 16px rgba(255, 152, 0, 0.15)',
                      transition: 'transform 0.3s ease',
                      border: '1px solid #ffcc80',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}>
                      <CardContent sx={{ textAlign: 'center', p: 3 }}>
                        <Schedule sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {salaryBreakdown.summary.totalHalfDays}
                        </Typography>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Half Days
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)',
                      color: '#c62828',
                      borderRadius: '16px',
                      boxShadow: '0 4px 16px rgba(244, 67, 54, 0.15)',
                      transition: 'transform 0.3s ease',
                      border: '1px solid #ffcdd2',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}>
                      <CardContent sx={{ textAlign: 'center', p: 3 }}>
                        <Cancel sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {salaryBreakdown.summary.totalAbsentDays}
                        </Typography>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Absent Days
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                      color: '#1565c0',
                      borderRadius: '16px',
                      boxShadow: '0 4px 16px rgba(33, 150, 243, 0.15)',
                      transition: 'transform 0.3s ease',
                      border: '1px solid #bbdefb',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}>
                      <CardContent sx={{ textAlign: 'center', p: 3 }}>
                        <AccessTime sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {salaryBreakdown.summary.totalOvertimeHours}h
                        </Typography>
                        <Typography variant="body1" sx={{ opacity: 0.9 }}>
                          Overtime Hours
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Enhanced Day-wise Breakdown */}
            <Box sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: '#2C3E50' }}>
                📅 Day-wise Salary Breakdown
              </Typography>
              
              {/* Table Header */}
              <Paper sx={{ 
                p: 2, 
                mb: 2, 
                background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                border: '1px solid #e9ecef',
                borderRadius: '12px'
              }}>
                <Grid container spacing={2} alignItems="center" sx={{ fontWeight: 600, color: '#2C3E50' }}>
                  <Grid item xs={1}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Sr No</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Date</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Status</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Hours</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Amount</Typography>
                  </Grid>
                  <Grid item xs={2}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Deduction Reason</Typography>
                  </Grid>
                  <Grid item xs={1}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Net</Typography>
                  </Grid>
                </Grid>
              </Paper>
              
              <Box sx={{ 
                maxHeight: '500px', 
                overflowY: 'auto',
                borderRadius: '12px',
                border: '1px solid #e9ecef'
              }}>
                {salaryBreakdown?.dayWiseBreakdown.map((day, index) => (
                  <Paper 
                    key={index} 
                    sx={{ 
                      p: 2, 
                      mb: 1, 
                      mx: 1,
                      mt: index === 0 ? 1 : 0,
                      border: '1px solid #e9ecef',
                      borderRadius: '12px',
                      background: day.status === 'present' ? 'linear-gradient(135deg, #f8fff8 0%, #ffffff 100%)' : 
                                 day.status === 'absent' ? 'linear-gradient(135deg, #ffebee 0%, #ffffff 100%)' : 
                                 day.status === 'holiday' ? 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)' :
                                 'linear-gradient(135deg, #fff3e0 0%, #ffffff 100%)',
                      borderLeft: `4px solid ${
                        day.status === 'present' ? '#4caf50' : 
                        day.status === 'absent' ? '#f44336' : 
                        day.status === 'holiday' ? '#9e9e9e' : '#ff9800'
                      }`,
                      transition: 'all 0.3s ease',
                      '&:hover': { 
                        transform: 'translateX(2px)',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
                      }
                    }}
                  >
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={1}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#666' }}>
                          {index + 1}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarToday sx={{ fontSize: 16, color: '#666' }} />
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
                            {formatDate(day.date)}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={2}>
                        {getStatusChip(day)}
                      </Grid>
                      
                      <Grid item xs={2}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Work sx={{ fontSize: 16 }} />
                            {day.workingHours}h
                          </Typography>
                          {day.overtimeHours > 0 && (
                            <Typography variant="body2" sx={{ color: '#2196f3', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <AccessTime sx={{ fontSize: 16 }} />
                              +{day.overtimeHours}h OT
                            </Typography>
                          )}
                        </Box>
                      </Grid>
                      
                      <Grid item xs={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <MonetizationOn sx={{ fontSize: 18, color: day.daySalary > 0 ? '#4caf50' : '#f44336' }} />
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600,
                              color: day.daySalary > 0 ? '#4caf50' : '#f44336'
                            }}
                          >
                            {day.daySalary > 0 ? '+' : ''}{formatCurrency(day.daySalary)}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={2}>
                        <Typography variant="body2" sx={{ color: '#666' }}>
                          {day.dayDeduction > 0 ? (
                            day.status === 'absent' ? 'Absent' :
                            day.status === 'half-day' ? 'Half Day' :
                            day.status === 'late' ? 'Late Arrival' :
                            day.status === 'holiday' ? 'Holiday' : 'Leave'
                          ) : '-'}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={1}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 600,
                            color: day.daySalary > day.dayDeduction ? '#4caf50' : '#f44336'
                          }}
                        >
                          {formatCurrency(day.daySalary - day.dayDeduction)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Box>
            </Box>

            {/* Enhanced Total Summary */}
            {salaryBreakdown && (
              <Box sx={{ 
                background: 'linear-gradient(135deg, #2C3E50 0%, #34495e 100%)',
                color: 'white',
                p: 4,
                borderRadius: '12px',
                margin: '24px'
              }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                      📊 Monthly Summary
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9, lineHeight: 1.6 }}>
                      <strong>Working Days:</strong> {salaryBreakdown.summary.totalPresentDays + salaryBreakdown.summary.totalHalfDays} | 
                      <strong> Absent Days:</strong> {salaryBreakdown.summary.totalAbsentDays} | 
                      <strong> Overtime:</strong> {salaryBreakdown.summary.totalOvertimeHours}h
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                        {formatCurrency(salaryBreakdown.summary.netSalary)}
                      </Typography>
                      <Typography variant="body1" sx={{ opacity: 0.9 }}>
                        Net Salary for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-IN', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, background: '#ffffff', borderTop: '1px solid #e9ecef', borderRadius: '0px 0px 16px 16px' }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          sx={{ 
            borderRadius: '12px',
            px: 3,
            py: 1,
            borderColor: '#2C3E50',
            color: '#2C3E50',
            '&:hover': {
              borderColor: '#34495e',
              backgroundColor: 'rgba(44, 62, 80, 0.04)'
            }
          }}
        >
          Close
        </Button>
        <Button 
          onClick={generatePayslip}
          variant="contained"
          sx={{ 
            borderRadius: '12px',
            px: 3,
            py: 1,
            background: 'linear-gradient(135deg, #2C3E50 0%, #34495e 100%)',
            boxShadow: '0 4px 16px rgba(44, 62, 80, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #34495e 0%, #2C3E50 100%)',
              boxShadow: '0 6px 20px rgba(44, 62, 80, 0.4)'
            }
          }}
        >
          📄 Generate Payslip
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmployeeSalaryDetail;