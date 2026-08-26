// src/components/SlipActionDialogs.jsx
//
// Four per-slip action dialogs for the Employee Summary Tab.
// All dialogs follow a common pattern:
//   - open / onClose / onSuccess props
//   - slip ({ _id, payrollRunId }) and run ({ _id }) props
//   - local loading / error state
//   - PATCH call to /api/payroll-runs/:runId/slips/:slipId/<action>
//   - on success: calls onSuccess() so parent can reload data
//
// Named exports:  AddLopDialog, AddOneTimeEntryDialog, WithholdDialog, ReverseLopDialog, RecordPaymentDialog

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import api from '../api/axios';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function extractErrorMessage(e) {
  return e?.response?.data?.error || e?.message || 'An unexpected error occurred.';
}

// ─── AddLopDialog ─────────────────────────────────────────────────────────────
// Fields: days (number, min 0.5, required), reason (text, required)
// API: PATCH /api/payroll-runs/:runId/slips/:slipId/lop

export function AddLopDialog({ open, onClose, onSuccess, slip, run }) {
  const [days,    setDays]    = useState('');
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDays('');
      setReason('');
      setError('');
      setLoading(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setError('');
    const parsedDays = parseFloat(days);
    if (!days || isNaN(parsedDays) || parsedDays < 0.5) {
      setError('Days must be a number ≥ 0.5.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }

    setLoading(true);
    try {
      await api.patch(
        `/payroll-runs/${run._id}/slips/${slip._id}/lop`,
        { days: parsedDays, reason: reason.trim() },
      );
      onSuccess();
      onClose();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add LOP Adjustment</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 0 }}>{error}</Alert>}

        <TextField
          label="Days"
          type="number"
          inputProps={{ min: 0.5, step: 0.5 }}
          value={days}
          onChange={e => setDays(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
          helperText="Minimum 0.5 days"
        />

        <TextField
          label="Reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
          multiline
          minRows={2}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: 'var(--ink-secondary)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          sx={{ minWidth: 100, fontWeight: 700 }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Add LOP'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── AddOneTimeEntryDialog ────────────────────────────────────────────────────
// Fields: label (text, required), amount (number, required), kind toggle (earning | deduction)
// API: PATCH /api/payroll-runs/:runId/slips/:slipId/one-time

export function AddOneTimeEntryDialog({ open, onClose, onSuccess, slip, run }) {
  const [label,   setLabel]   = useState('');
  const [amount,  setAmount]  = useState('');
  const [kind,    setKind]    = useState('earning');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (open) {
      setLabel('');
      setAmount('');
      setKind('earning');
      setError('');
      setLoading(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setError('');
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    setLoading(true);
    try {
      await api.patch(
        `/payroll-runs/${run._id}/slips/${slip._id}/one-time`,
        { label: label.trim(), amount: parsedAmount, kind },
      );
      onSuccess();
      onClose();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Earnings / Deductions</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 0 }}>{error}</Alert>}

        <Box>
          <Typography
            variant="caption"
            sx={{ color: 'var(--ink-secondary)', fontWeight: 500, display: 'block', mb: 0.75 }}
          >
            Type *
          </Typography>
          <ToggleButtonGroup
            value={kind}
            exclusive
            onChange={(_, value) => { if (value) setKind(value); }}
            disabled={loading}
            size="small"
            aria-label="Entry type"
            fullWidth
          >
            <ToggleButton value="earning"   aria-label="Earning">Earning</ToggleButton>
            <ToggleButton value="deduction" aria-label="Deduction">Deduction</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <TextField
          label="Label"
          value={label}
          onChange={e => setLabel(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
          placeholder="e.g. Performance bonus"
        />

        <TextField
          label="Amount (₹)"
          type="number"
          inputProps={{ min: 0, step: 1 }}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: 'var(--ink-secondary)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          sx={{ minWidth: 100, fontWeight: 700 }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Add Entry'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── WithholdDialog ───────────────────────────────────────────────────────────
// Fields: reason (text, required)
// API: PATCH /api/payroll-runs/:runId/slips/:slipId/withhold

export function WithholdDialog({ open, onClose, onSuccess, slip, run }) {
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
      setLoading(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setError('');
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }

    setLoading(true);
    try {
      await api.patch(
        `/payroll-runs/${run._id}/slips/${slip._id}/withhold`,
        { reason: reason.trim() },
      );
      onSuccess();
      onClose();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Withhold Salary</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 0 }}>{error}</Alert>}

        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
          This slip will be excluded from payment processing until released. Provide a reason for
          the hold.
        </Typography>

        <TextField
          label="Reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
          multiline
          minRows={2}
          placeholder="e.g. Pending disciplinary review"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: 'var(--ink-secondary)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          sx={{
            minWidth: 120,
            fontWeight: 700,
            bgcolor: '#b45309',
            '&:hover': { bgcolor: '#92400e' },
          }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Withhold'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── ReverseLopDialog ─────────────────────────────────────────────────────────
// Fields: days (number, required), reason (text, required)
// API: PATCH /api/payroll-runs/:runId/slips/:slipId/reverse-lop

export function ReverseLopDialog({ open, onClose, onSuccess, slip, run }) {
  const [days,    setDays]    = useState('');
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (open) {
      setDays('');
      setReason('');
      setError('');
      setLoading(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setError('');
    const parsedDays = parseFloat(days);
    if (!days || isNaN(parsedDays) || parsedDays <= 0) {
      setError('Days must be a positive number.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }

    setLoading(true);
    try {
      await api.patch(
        `/payroll-runs/${run._id}/slips/${slip._id}/reverse-lop`,
        { days: parsedDays, reason: reason.trim() },
      );
      onSuccess();
      onClose();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Reverse LOP</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 0 }}>{error}</Alert>}

        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
          Enter the number of LOP days to reverse and the reason for the correction. The adjustment
          will be applied additively to this slip's LOP balance.
        </Typography>

        <TextField
          label="Days to Reverse"
          type="number"
          inputProps={{ min: 0.5, step: 0.5 }}
          value={days}
          onChange={e => setDays(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
        />

        <TextField
          label="Reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
          multiline
          minRows={2}
          placeholder="e.g. Incorrect AMS attendance entry for 3rd Aug"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: 'var(--ink-secondary)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          sx={{ minWidth: 120, fontWeight: 700 }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Reverse LOP'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── RecordPaymentDialog ──────────────────────────────────────────────────────
// Fields: paymentMode (select, required), paidAt (date, required), notifyEmployee (checkbox)
// Used for bulk "Mark as Paid" action
// API: POST /api/payroll-runs/:runId/slips/:slipId/mark-paid (called per selected slip)

export function RecordPaymentDialog({ open, onClose, onConfirm, loading, error }) {
  const [paymentMode, setPaymentMode] = useState('bankTransfer');
  const [paidAt, setPaidAt] = useState('');
  const [notifyEmployee, setNotifyEmployee] = useState(false);

  useEffect(() => {
    if (open) {
      setPaymentMode('bankTransfer');
      // Default to today's date in YYYY-MM-DD format
      setPaidAt(new Date().toISOString().split('T')[0]);
      setNotifyEmployee(false);
    }
  }, [open]);

  const handleConfirm = () => {
    if (!paymentMode || !paidAt) {
      return;
    }
    onConfirm({ paymentMode, paidAt, notifyEmployee });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Record Payment</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 0 }}>{error}</Alert>}

        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
          Record payment details for the selected employee(s). This will mark the salary slip(s) as paid.
        </Typography>

        <FormControl fullWidth size="small" required>
          <InputLabel id="payment-mode-label">Payment Mode</InputLabel>
          <Select
            labelId="payment-mode-label"
            value={paymentMode}
            label="Payment Mode"
            onChange={e => setPaymentMode(e.target.value)}
            disabled={loading}
          >
            <MenuItem value="bankTransfer">Bank Transfer</MenuItem>
            <MenuItem value="cheque">Cheque</MenuItem>
            <MenuItem value="cash">Cash</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Payment Date"
          type="date"
          value={paidAt}
          onChange={e => setPaidAt(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
          InputLabelProps={{ shrink: true }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={notifyEmployee}
              onChange={e => setNotifyEmployee(e.target.checked)}
              disabled={loading}
              size="small"
            />
          }
          label={
            <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
              Notify employee by email (requires email configuration)
            </Typography>
          }
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: 'var(--ink-secondary)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading || !paymentMode || !paidAt}
          sx={{
            minWidth: 120,
            fontWeight: 700,
            bgcolor: '#15803d',
            '&:hover': { bgcolor: '#14532d' },
          }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Record Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
