import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Chip,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  WarningAmber as WarningIcon
} from '@mui/icons-material';
import api from '../../api/axios';

const RED = '#E53935';
const RED_BG = '#FDECEC';
const BLACK = '#1A1A1A';
const GREY = '#6B7280';

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

  const cardBase = {
    background: '#fff',
    borderRadius: '16px',
    padding: '20px 24px',
    border: '1px solid #E5E7EB',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    '&:hover': {
      boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
      transform: 'translateY(-1px)'
    }
  };

  if (loading) {
    return (
      <Box sx={cardBase}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={28} sx={{ color: RED }} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={cardBase}>
        <Alert severity="error" variant="outlined" sx={{ borderRadius: '12px' }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <Box sx={{ ...cardBase, background: RED_BG, border: `1px solid #FBBCBC` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: '#FBBCBC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <WarningIcon sx={{ fontSize: 20, color: RED }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '14px', color: BLACK }}>CIF Summary</Typography>
            <Typography sx={{ fontSize: '13px', color: GREY, mt: 0.25 }}>
              No CIF records found for this employee.
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        ...cardBase,
        background: RED_BG,
        border: `1px solid #FBBCBC`,
        borderLeft: `4px solid ${RED}`
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: '#FBBCBC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <WarningIcon sx={{ fontSize: 20, color: RED }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '15px', color: BLACK }}>
            CIF Summary
          </Typography>
        </Box>
        <Chip
          label={`Risk: ${summary.riskLevel.toUpperCase()}`}
          size="small"
          color={getRiskColor(summary.riskLevel)}
          sx={{
            fontWeight: 700,
            fontSize: '11px',
            borderRadius: '8px',
            height: 26
          }}
        />
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Box
            sx={{
              background: '#fff',
              borderRadius: '12px',
              padding: '12px 14px',
              border: '1px solid #E5E7EB'
            }}
          >
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: GREY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              Total Cases
            </Typography>
            <Typography sx={{ fontSize: '24px', fontWeight: 800, color: BLACK, lineHeight: 1 }}>
              {summary.total}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box
            sx={{
              background: '#fff',
              borderRadius: '12px',
              padding: '12px 14px',
              border: '1px solid #E5E7EB'
            }}
          >
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: GREY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              Open Cases
            </Typography>
            <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>
              {summary.open}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box
            sx={{
              background: '#fff',
              borderRadius: '12px',
              padding: '12px 14px',
              border: '1px solid #E5E7EB'
            }}
          >
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: GREY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              High Severity
            </Typography>
            <Typography sx={{ fontSize: '24px', fontWeight: 800, color: RED, lineHeight: 1 }}>
              {summary.highCount}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box
            sx={{
              background: '#fff',
              borderRadius: '12px',
              padding: '12px 14px',
              border: '1px solid #E5E7EB'
            }}
          >
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: GREY, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              Last Incident
            </Typography>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: BLACK, lineHeight: 1.3, mt: 0.5 }}>
              {formatDate(summary.lastIncidentDate)}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CIFSummaryCard;
