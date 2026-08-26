// src/pages/PayrollRunsPage.jsx
// Status chips use semantic tokens. Paid rows get the ledger seal badge.
// All rupee amounts use .currency class for tabular-nums.
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert, Skeleton,
} from '@mui/material';
import { Add, Visibility } from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function fmtINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

// Status chip — uses semantic design tokens from index.css
function StatusChip({ status }) {
  const sx = {
    draft:     { bgcolor: '#f3f4f6', color: 'var(--status-draft)',     fontWeight: 700 },
    finalized: { bgcolor: '#fffbeb', color: 'var(--status-finalized)', fontWeight: 700 },
    paid:      { bgcolor: 'var(--status-paid-tint)', color: 'var(--status-paid)', fontWeight: 700 },
  }[status] || { fontWeight: 600 };

  return (
    <Chip
      label={status}
      size="small"
      sx={{ borderRadius: 'var(--radius-pill)', fontSize: '0.6875rem', textTransform: 'capitalize', ...sx }}
    />
  );
}

// Paid row ledger seal — appears only when status === 'paid'
function LedgerSealBadge() {
  return (
    <Tooltip title="Settled &amp; paid" placement="top">
      <span
        style={{
          display: 'inline-block',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'var(--ledger-seal)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.45)',
          verticalAlign: 'middle',
          marginLeft: 6,
          flexShrink: 0,
        }}
        aria-label="Paid"
      />
    </Tooltip>
  );
}

export default function PayrollRunsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'Admin';

  const [runs,    setRuns]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState({ month: '', year: '', notes: '' });
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/payroll-runs')
      .then(r => setRuns(r.data.runs || []))
      .catch(() => setError('Failed to load payroll runs.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setFormErr('');
    const m = parseInt(form.month, 10);
    const y = parseInt(form.year,  10);
    if (!m || m < 1 || m > 12) { setFormErr('Enter a valid month (1–12).'); return; }
    if (!y || y < 2020)         { setFormErr('Enter a valid year (≥ 2020).'); return; }
    setSaving(true);
    try {
      await api.post('/payroll-runs', { month: m, year: y, notes: form.notes });
      setOpen(false);
      setForm({ month: '', year: '', notes: '' });
      load();
    } catch (e) {
      setFormErr(e.response?.data?.error || 'Failed to create run.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>Payroll Runs</Typography>
          <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.25 }}>
            {runs.length > 0 ? `${runs.length} run${runs.length !== 1 ? 's' : ''} total` : 'No runs yet'}
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpen(true)}
            sx={{ bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
          >
            New Run
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Period', 'Status', 'Employees', 'Gross Pay', 'Net Pay', 'Created', ''].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? [1, 2, 3, 4].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6, 7].map(j => (
                      <TableCell key={j}><Skeleton height={20} /></TableCell>
                    ))}
                  </TableRow>
                ))
                : runs.map(run => (
                  <TableRow
                    key={run._id}
                    hover
                    sx={run.status === 'paid' ? { bgcolor: '#fafff9' } : {}}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--ink)' }}>
                        {new Date(run.year, run.month - 1)
                          .toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={run.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" className="currency" sx={{ color: 'var(--ink-secondary)' }}>
                        {run.employeeCount ?? 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" className="currency" sx={{ color: 'var(--ink-secondary)' }}>
                        {fmtINR(run.totalGross)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" className="currency" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
                          {fmtINR(run.totalNet)}
                        </Typography>
                        {/* Ledger seal marks the settled figure itself, not the period —
                            keeping it off the date column avoids it reading as a second,
                            conflicting status signal next to the green "Paid" chip. */}
                        {run.status === 'paid' && <LedgerSealBadge />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
                        {new Date(run.createdAt).toLocaleDateString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/payroll-runs/${run._id}`)}
                          aria-label={`View ${run.year}-${run.month} payroll run`}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              }
              {!loading && runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box sx={{ py: 5 }}>
                      <ReceiptLongEmpty />
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        No payroll runs yet. Click "New Run" to create the first one.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create run dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create Payroll Run</DialogTitle>
        <DialogContent>
          {formErr && <Alert severity="error" sx={{ mb: 2 }}>{formErr}</Alert>}
          <Box sx={{ display: 'flex', gap: 2, mt: 1, mb: 2 }}>
            <TextField
              label="Month" type="number" value={form.month} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
              inputProps={{ min: 1, max: 12 }}
            />
            <TextField
              label="Year" type="number" value={form.year} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
              inputProps={{ min: 2020 }}
            />
          </Box>
          <TextField
            label="Notes (optional)" value={form.notes} multiline rows={2} fullWidth size="small"
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving}
            sx={{ bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
          >
            {saving ? 'Creating…' : 'Create Run'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Local empty-state icon
function ReceiptLongEmpty() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ display: 'block', margin: '0 auto' }}>
      <rect x="8" y="4" width="32" height="40" rx="4" stroke="#e5e7eb" strokeWidth="2" />
      <rect x="14" y="14" width="20" height="2" rx="1" fill="#e5e7eb" />
      <rect x="14" y="20" width="14" height="2" rx="1" fill="#e5e7eb" />
      <rect x="14" y="26" width="18" height="2" rx="1" fill="#e5e7eb" />
    </svg>
  );
}
