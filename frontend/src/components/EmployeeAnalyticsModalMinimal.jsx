// Minimal version of EmployeeAnalyticsModal to isolate React error
import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';

import { SkeletonBox } from '../components/SkeletonLoaders';
const EmployeeAnalyticsModalMinimal = ({ open, onClose, employeeId, employeeName }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  const fetchEmployeeAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const nowDate = new Date();
      const prev = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
      const startOfMonth = new Date(prev.getFullYear(), prev.getMonth(), 1);
      const endOfMonth = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
      const startDate = startOfMonth.toISOString().slice(0, 10);
      const endDate = endOfMonth.toISOString().slice(0, 10);
      
      console.log(`Fetching analytics for employee ${employeeId} from ${startDate} to ${endDate}`);
      
      const response = await axios.get(`/analytics/employee/${employeeId}?startDate=${startDate}&endDate=${endDate}`);
      
      console.log('Analytics response:', response.data);
      
      if (response.data) {
        setAnalyticsData(response.data);
      } else {
        setError('No data received from server');
      }
    } catch (error) {
      console.error('Error fetching employee analytics:', error);
      console.error('Error details:', error.response?.data || error.message);
      setError(`Failed to fetch employee analytics: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && employeeId) {
      fetchEmployeeAnalytics();
    }
  }, [open, employeeId]);

  // Early return if not open - moved after hooks
  if (!open || !employeeId) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {employeeName || 'Employee'} Analytics
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="200px">
            <SkeletonBox width="24px" height="24px" borderRadius="50%" />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : analyticsData ? (
          <Box>
            <Typography variant="h6" gutterBottom>
              Employee: {analyticsData.employee?.name || 'N/A'}
            </Typography>
            <Typography variant="body1" gutterBottom>
              Email: {analyticsData.employee?.email || 'N/A'}
            </Typography>
            <Typography variant="body1" gutterBottom>
              Department: {analyticsData.employee?.department || 'N/A'}
            </Typography>
            {analyticsData.metrics && (
              <Box mt={2}>
                <Typography variant="h6" gutterBottom>
                  Attendance Metrics
                </Typography>
                <Typography variant="body2">
                  Present Days: {analyticsData.metrics.onTimeDays || 0}
                </Typography>
                <Typography variant="body2">
                  Late Days: {analyticsData.metrics.lateDays || 0}
                </Typography>
                <Typography variant="body2">
                  Half Days: {analyticsData.metrics.halfDays || 0}
                </Typography>
                <Typography variant="body2">
                  Absent Days: {analyticsData.metrics.absentDays || 0}
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Typography>No data available</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={fetchEmployeeAnalytics} variant="contained">
          Refresh
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmployeeAnalyticsModalMinimal;
