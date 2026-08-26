// src/pages/AuditLogsPage.jsx — Admin only
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Alert, Skeleton, MenuItem,
  TablePagination, Grid,
} from '@mui/material';
import api from '../api/axios';

// Semantic action colours — error=security risk, warning=revocation, success=auth OK
const ACTION_COLORS = {
  LOGIN_FAILED:                 { bg: '#fef2f2', color: '#dc2626', label: 'FAIL' },
  REFRESH_TOKEN_REUSE_DETECTED: { bg: '#fef2f2', color: '#dc2626', label: 'FAIL' },
  LOGIN_SUCCESS:                { bg: '#dcfce7', color: '#15803d', label: 'OK'   },
  LOGOUT:                       { bg: '#f3f4f6', color: '#6b7280', label: null   },
  LINK_REVOKED:                 { bg: '#fffbeb', color: '#b45309', label: null   },
  LINK_EXPIRED_ACCESS_ATTEMPT:  { bg: '#fffbeb', color: '#b45309', label: null   },
  FOLDER_DELETED:               { bg: '#fef2f2', color: '#dc2626', label: null   },
  FILE_DELETED:                 { bg: '#fef2f2', color: '#dc2626', label: null   },
};

// Stable chip style — avoids MUI color= overriding our semantic map
function ActionChip({ action }) {
  const def = ACTION_COLORS[action];
  const style = def
    ? { backgroundColor: def.bg, color: def.color }
    : { backgroundColor: '#f3f4f6', color: '#6b7280' };

  return (
    <Chip
      label={action.replace(/_/g, ' ')}
      size="small"
      sx={{
        ...style,
        fontWeight: 600,
        fontSize: '0.7rem',
        borderRadius: 'var(--radius-pill)',
        height: 22,
        maxWidth: 220,
        '& .MuiChip-label': { px: '8px', whiteSpace: 'normal', lineHeight: 1.3 },
      }}
    />
  );
}

function ResultChip({ success }) {
  return (
    <Chip
      label={success ? 'OK' : 'FAIL'}
      size="small"
      sx={{
        backgroundColor: success ? '#dcfce7' : '#fef2f2',
        color:           success ? '#15803d' : '#dc2626',
        fontWeight: 700,
        fontSize: '0.7rem',
        borderRadius: 'var(--radius-pill)',
        height: 20,
      }}
    />
  );
}

const ALL_ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
  'LINK_CREATED', 'LINK_REDEEMED', 'LINK_REVOKED', 'LINK_EXPIRED_ACCESS_ATTEMPT',
  'SALARY_SLIP_GENERATED',
  'FOLDER_CREATED', 'FOLDER_DELETED', 'FILE_UPLOADED', 'FILE_DELETED',
  'FINANCIAL_PROFILE_CREATED', 'FINANCIAL_PROFILE_UPDATED',
  'PAYROLL_RUN_CREATED', 'PAYROLL_RUN_FINALIZED',
  'USER_CREATED', 'REFRESH_TOKEN_REUSE_DETECTED',
];

const COL_HEADERS = ['Timestamp', 'Action', 'Performed By', 'Subject', 'IP Address', 'Result'];

export default function AuditLogsPage() {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [page,    setPage]    = useState(0);
  const [rowsPP,  setRowsPP]  = useState(50);

  const [filter, setFilter] = useState({ action: '', subject: '', from: '', to: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = { page: page + 1, limit: rowsPP };
    if (filter.action)  params.action  = filter.action;
    if (filter.subject) params.subject = filter.subject;
    if (filter.from)    params.from    = filter.from;
    if (filter.to)      params.to      = filter.to;
    api.get('/audit-logs', { params })
      .then(r => { setLogs(r.data.logs || []); setTotal(r.data.total || 0); })
      .catch(() => setError('Failed to load audit logs.'))
      .finally(() => setLoading(false));
  }, [page, rowsPP, filter]);

  useEffect(() => { load(); }, [load]);

  const f = (key, val) => { setFilter(s => ({ ...s, [key]: val })); setPage(0); };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
          Audit Logs
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.5 }}>
          Immutable record of all system events and access activity
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--radius-control)' }}>{error}</Alert>}

      {/* Filter row */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              label="Action"
              value={filter.action}
              size="small"
              fullWidth
              select
              onChange={e => f('action', e.target.value)}
            >
              <MenuItem value="">All actions</MenuItem>
              {ALL_ACTIONS.map(a => (
                <MenuItem key={a} value={a} sx={{ fontSize: '0.8125rem' }}>
                  {a.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Subject / token"
              value={filter.subject}
              size="small"
              fullWidth
              onChange={e => f('subject', e.target.value)}
              placeholder="email or token prefix…"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              label="From"
              type="date"
              value={filter.from}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              onChange={e => f('from', e.target.value)}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              label="To"
              type="date"
              value={filter.to}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              onChange={e => f('to', e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              {COL_HEADERS.map(h => (
                <TableCell
                  key={h}
                  sx={{
                    backgroundColor: 'var(--sidebar-navy-deep)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    borderBottom: 'none',
                    whiteSpace: 'nowrap',
                    py: 1.5,
                  }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <TableRow key={i}>
                  {[1, 2, 3, 4, 5, 6].map(j => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
              : logs.map(log => (
                <TableRow
                  key={log._id}
                  hover
                  sx={{
                    // Highlight security-critical rows with a very faint tint
                    ...(ACTION_COLORS[log.action]?.color === '#dc2626' && {
                      backgroundColor: 'rgba(220, 38, 38, 0.025)',
                    }),
                  }}
                >
                  {/* Timestamp */}
                  <TableCell sx={{ whiteSpace: 'nowrap', py: 1 }}>
                    <Typography variant="caption" sx={{ color: 'var(--ink)', fontWeight: 500 }}>
                      {new Date(log.timestamp).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </Typography>
                    <Typography
                      variant="caption"
                      display="block"
                      sx={{ color: 'var(--ink-secondary)', fontSize: '0.7rem' }}
                    >
                      {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </Typography>
                  </TableCell>

                  {/* Action chip */}
                  <TableCell sx={{ py: 1 }}>
                    <ActionChip action={log.action} />
                  </TableCell>

                  {/* Performed by */}
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="caption" sx={{ color: 'var(--ink)' }}>
                      {log.performedByEmail || '—'}
                    </Typography>
                  </TableCell>

                  {/* Subject — monospace for token hashes / emails */}
                  <TableCell sx={{ py: 1, maxWidth: 220 }}>
                    <Typography
                      variant="caption"
                      className="monospace"
                      sx={{
                        color: 'var(--ink)',
                        wordBreak: 'break-all',
                        display: 'block',
                      }}
                    >
                      {log.subject || '—'}
                    </Typography>
                  </TableCell>

                  {/* IP address — monospace */}
                  <TableCell sx={{ py: 1, whiteSpace: 'nowrap' }}>
                    <Typography className="monospace" variant="caption" sx={{ color: 'var(--ink)' }}>
                      {log.ipAddress || '—'}
                    </Typography>
                  </TableCell>

                  {/* Result chip */}
                  <TableCell sx={{ py: 1 }}>
                    <ResultChip success={log.success} />
                  </TableCell>
                </TableRow>
              ))
            }

            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
                    No audit events match the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPP}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPageOptions={[25, 50, 100]}
          onRowsPerPageChange={e => { setRowsPP(parseInt(e.target.value, 10)); setPage(0); }}
          sx={{
            borderTop: '1px solid var(--border)',
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              fontSize: '0.8125rem',
              color: 'var(--ink-secondary)',
            },
          }}
        />
      </TableContainer>
    </Box>
  );
}
