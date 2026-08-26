// src/components/ApprovalToolbar.jsx
//
// Phase 5 — Approval workflow toolbar for PayrollRunDetailPage.
//
// Displays status-appropriate approval actions:
//   Draft run + Admin:            "Submit & Approve" (single-step combined action)
//   Draft run + PayrollOfficer:   "Submit for Approval"
//   Submitted run + Admin:        "Approve" + "Reject" buttons
//   Approved run + Admin:         "Final Approve" (override, rare)
//   Rejected run:                 Rejection banner + "Resubmit" button
//
// All actions call the approval endpoints (submit, approve, reject) and trigger
// a reload via onReload callback.
//
// Props:
//   - run:     PayrollRun object with status, approvalStatus, rejectionReason
//   - isAdmin: boolean (user role === 'Admin')
//   - onReload: function to refresh parent data after successful action

import React, { useState } from 'react';
import {
  Box,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Send,
  WarningAmberRounded,
} from '@mui/icons-material';
import api from '../api/axios';

function extractErrorMessage(e) {
  return e?.response?.data?.error || e?.message || 'An unexpected error occurred.';
}

// ─── RejectDialog ─────────────────────────────────────────────────────────────
// Requires a non-empty rejectionReason before calling the reject endpoint.

function RejectDialog({ open, onClose, onSuccess, runId }) {
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  React.useEffect(() => {
    if (open) {
      setReason('');
      setError('');
      setLoading(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setError('');
    if (!reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/payroll-runs/${runId}/reject`, {
        rejectionReason: reason.trim(),
      });
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
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700 }}>
        <WarningAmberRounded sx={{ color: '#d32f2f', fontSize: 22 }} />
        Reject Payroll Run
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 0 }}>{error}</Alert>}

        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
          This run will be rejected and sent back for revision. Provide a reason explaining why
          the run is being rejected.
        </Typography>

        <TextField
          label="Rejection Reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          disabled={loading}
          required
          fullWidth
          size="small"
          multiline
          minRows={3}
          placeholder="e.g. TDS calculations need review"
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
            bgcolor: 'var(--brand-red)',
            '&:hover': { bgcolor: 'var(--brand-red-hover)' },
          }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Reject Run'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── ApprovalToolbar ──────────────────────────────────────────────────────────

export default function ApprovalToolbar({ run, isAdmin, onReload }) {
  const [working,      setWorking]      = useState(false);
  const [error,        setError]        = useState('');
  const [rejectOpen,   setRejectOpen]   = useState(false);

  if (!run) return null;

  const { status, approvalStatus, rejectionReason } = run;
  const isDraft     = status === 'draft';
  const isSubmitted = approvalStatus === 'submitted';
  const isApproved  = approvalStatus === 'approved';
  const isRejected  = approvalStatus === 'rejected';

  const handleAction = async (endpoint, successMsg) => {
    setError('');
    setWorking(true);
    try {
      await api.post(`/payroll-runs/${run._id}/${endpoint}`);
      onReload();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const handleSubmit = () => handleAction('submit', 'Run submitted for approval.');
  const handleApprove = () => handleAction('approve', 'Run approved.');
  const handleResubmit = () => handleAction('submit', 'Run resubmitted for approval.');

  const handleRejectSuccess = () => {
    setRejectOpen(false);
    onReload();
  };

  // ── Rejected state banner ──
  if (isRejected) {
    return (
      <Box sx={{ mb: 3 }}>
        <Alert
          severity="warning"
          sx={{
            bgcolor: '#fffbeb',
            border: '1px solid #fbbf24',
            color: '#92400e',
            fontWeight: 500,
            '& .MuiAlert-icon': { color: '#f59e0b' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Run Rejected
              </Typography>
              <Typography variant="body2" sx={{ color: '#92400e' }}>
                {rejectionReason}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<Send />}
              onClick={handleResubmit}
              disabled={working}
              sx={{
                fontWeight: 700,
                borderColor: '#f59e0b',
                color: '#92400e',
                '&:hover': { borderColor: '#d97706', bgcolor: '#fffbeb' },
              }}
            >
              {working ? 'Working…' : 'Resubmit'}
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  // ── Approval actions toolbar ──
  return (
    <Box sx={{ mb: 3 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {/* Draft run — Admin: combined submit & approve; PayrollOfficer: submit only */}
        {isDraft && !isApproved && (
          <>
            {isAdmin ? (
              <Button
                variant="contained"
                startIcon={<CheckCircle />}
                onClick={handleSubmit}
                disabled={working}
                size="large"
                sx={{
                  fontWeight: 700,
                  minWidth: 180,
                  bgcolor: '#15803d',
                  '&:hover': { bgcolor: '#14532d' },
                }}
              >
                {working ? 'Working…' : 'Submit & Approve'}
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<Send />}
                onClick={handleSubmit}
                disabled={working}
                size="large"
                sx={{
                  fontWeight: 700,
                  minWidth: 180,
                  bgcolor: '#2563eb',
                  '&:hover': { bgcolor: '#1d4ed8' },
                }}
              >
                {working ? 'Working…' : 'Submit for Approval'}
              </Button>
            )}
          </>
        )}

        {/* Submitted run — Admin: approve or reject */}
        {isSubmitted && isAdmin && (
          <>
            <Button
              variant="contained"
              startIcon={<CheckCircle />}
              onClick={handleApprove}
              disabled={working}
              size="large"
              sx={{
                fontWeight: 700,
                minWidth: 140,
                bgcolor: '#15803d',
                '&:hover': { bgcolor: '#14532d' },
              }}
            >
              {working ? 'Working…' : 'Approve'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={() => setRejectOpen(true)}
              disabled={working}
              size="large"
              sx={{
                fontWeight: 700,
                minWidth: 140,
                borderColor: 'var(--brand-red)',
                color: 'var(--brand-red)',
                '&:hover': { borderColor: 'var(--brand-red-hover)', bgcolor: 'var(--brand-red-tint)' },
              }}
            >
              Reject
            </Button>
          </>
        )}

        {/* Approved run (draft status) — Admin: final approve override */}
        {isDraft && isApproved && isAdmin && (
          <Button
            variant="outlined"
            startIcon={<CheckCircle />}
            onClick={handleApprove}
            disabled={working}
            size="large"
            sx={{
              fontWeight: 700,
              minWidth: 160,
              borderColor: '#15803d',
              color: '#15803d',
              '&:hover': { borderColor: '#14532d', bgcolor: '#dcfce7' },
            }}
          >
            {working ? 'Working…' : 'Final Approve'}
          </Button>
        )}
      </Box>

      {/* Reject dialog */}
      <RejectDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSuccess={handleRejectSuccess}
        runId={run._id}
      />
    </Box>
  );
}
