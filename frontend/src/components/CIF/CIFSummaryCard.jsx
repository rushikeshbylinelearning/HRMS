import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Warning as WarningIcon
} from '@mui/icons-material';
import api from '../../api/axios';

const CIFSummaryCard = ({ employeeId }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (employeeId) {
      fetchSummary();
    }
  }, [employeeId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/admin/cif/employee-summary/${employeeId}`);
      setSummary(response.data);
    } catch (err) {
      console.error('Error fetching CIF summary:', err);
      setError('Failed to load CIF summary');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel) => {
    const colors = {
      critical: 'error',
      high: 'warning',
      medium: 'info',
      low: 'success'
    };
    return colors[riskLevel] || 'default';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={30} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <WarningIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="h6">CIF Summary</Typography>
          </Box>
          <Typography variant="body2" color="textSecondary">
            No CIF records found for this employee.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={1}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
            <Typography variant="h6">CIF Summary</Typography>
          </Box>
          <Chip
            label={`Risk: ${summary.riskLevel.toUpperCase()}`}
            color={getRiskColor(summary.riskLevel)}
            size="small"
          />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="textSecondary">
              Total Cases
            </Typography>
            <Typography variant="h5" fontWeight={600}>
              {summary.total}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="textSecondary">
              Open Cases
            </Typography>
            <Typography variant="h5" fontWeight={600} color="warning.main">
              {summary.open}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="textSecondary">
              High Severity
            </Typography>
            <Typography variant="h5" fontWeight={600} color="error.main">
              {summary.highCount}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="textSecondary">
              Last Incident
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {formatDate(summary.lastIncidentDate)}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default CIFSummaryCard;
