// src/pages/SalarySlipsPage.jsx
// All rupee figures use .currency (tabular-nums). Status chips use semantic tokens.
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, TextField, MenuItem, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  IconButton, Tooltip, Alert, Skeleton, InputAdornment,
} from '@mui/material';
import { OpenInNew, Download, Search } from '@mui/icons-material';
import api from '../api/axios';

const MONTHS = [
  '', 'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function fmtINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

function SlipStatusChip({ status }) {
  const sx = {
    viewed:  { bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700 },
    sent:    { bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 700 },
    default: { bgcolor: '#f3f4f6', color: '#6b7280', fontWeight: 600 },
  };
  const style = sx[status] || sx.default;
  return (
    <Chip
      label={status}
      size="small"
      sx={{ borderRadius: 'var(--radius-pill)', fontSize: '0.6875rem', textTransform: 'capitalize', ...style }}
    />
  );
}

export default function SalarySlipsPage() {
  const [slips,   setSlips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [empId, setEmpId] = useState('');
  const [month, setMonth] = useState('');
  const [year,  setYear]  = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (empId.trim()) params.employeeId = empId.trim();
    if (month)        params.month      = month;
    if (year)         params.year       = year;
    api.get('/salary-slips', { params })
      .then(r => setSlips(r.data.slips || []))
      .catch(() => setError('Failed to load salary slips.'))
      .finally(() => setLoading(false));
  }, [empId, month, year]);

  useEffect(() => { load(); }, [load]);

  const openUrl = async (id, mode) => {
    try {
      const res = await api.get(`/salary-slips/${id}/${mode}`);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch { setError('Could not generate URL.'); }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>Salary Slips</Typography>
        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.25 }}>
          {slips.length > 0 ? `${slips.length} slip${slips.length !== 1 ? 's' : ''} found` : 'Browse and download salary slips'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Employee ID" value={empId} size="small" fullWidth
            onChange={e => setEmpId(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: 'var(--ink-muted)' }} />
                </InputAdornment>
              ),
            }}
            placeholder="e.g. EMP001"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            select label="Month" value={month} size="small" fullWidth
            onChange={e => setMonth(e.target.value)}
          >
            <MenuItem value="">All months</MenuItem>
            {MONTHS.slice(1).map((m, i) => (
              <MenuItem key={i + 1} value={String(i + 1)}>{m}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Year" value={year} size="small" fullWidth type="number"
            onChange={e => setYear(e.target.value)}
            inputProps={{ min: 2020, placeholder: 'e.g. 2026' }}
          />
        </Grid>
      </Grid>

      <Paper sx={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Employee', 'Period', 'Gross Pay', 'Deductions', 'Net Pay', 'Status', 'View', 'Download'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? [1, 2, 3, 4, 5].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(j => (
                      <TableCell key={j}><Skeleton height={20} /></TableCell>
                    ))}
                  </TableRow>
                ))
                : slips.map(slip => (
                  <TableRow key={slip._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--ink)' }}>
                        {slip.employeeName || slip.employeeId}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--ink-secondary)' }}>
                        {slip.employeeId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
                        {new Date(slip.year, slip.month - 1)
                          .toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" className="currency" sx={{ color: 'var(--ink-secondary)' }}>
                        {fmtINR(slip.grossPay)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" className="currency" sx={{ color: 'var(--ink-secondary)' }}>
                        {fmtINR(slip.totalDeductions)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" className="currency" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
                        {fmtINR(slip.netPay)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <SlipStatusChip status={slip.status} />
                    </TableCell>
                    <TableCell>
                      {/* Tooltip explains WHY the icon is inactive when storageKey is
                          missing, instead of the icon just going faint with no
                          explanation — a low-opacity disabled icon with no context
                          reads as broken, not as "not ready yet". */}
                      <Tooltip title={slip.storageKey ? 'View inline' : 'PDF not yet generated for this slip'}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={!slip.storageKey}
                            onClick={() => openUrl(slip._id, 'view')}
                            aria-label={slip.storageKey ? 'View salary slip' : 'View salary slip (PDF not yet generated)'}
                            sx={{ color: 'var(--ink-secondary)', '&:hover': { color: 'var(--brand-red)' } }}
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={slip.storageKey ? 'Download PDF' : 'PDF not yet generated for this slip'}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={!slip.storageKey}
                            onClick={() => openUrl(slip._id, 'download')}
                            aria-label={slip.storageKey ? 'Download salary slip' : 'Download salary slip (PDF not yet generated)'}
                            sx={{ color: 'var(--ink-secondary)', '&:hover': { color: 'var(--brand-red)' } }}
                          >
                            <Download fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              }
              {!loading && slips.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Box sx={{ py: 5 }}>
                      <Typography color="text.secondary">
                        No salary slips found for this filter.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
