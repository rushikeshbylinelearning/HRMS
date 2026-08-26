// src/pages/PayrollRunDetailPage.jsx
// Highest-stakes screen:
// - Net-pay banner with ledger seal (stamp animation, Section 3 of brief)
// - Finalize / Mark-as-Paid buttons are larger + require two clicks (confirm dialog)
// - All rupee amounts use .currency (tabular-nums)
// - Ledger seal appears ONLY in the net-pay banner and the "Paid" header badge
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, Alert,
  Skeleton, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Tabs, Tab,
} from '@mui/material';
import {
  ArrowBack, PlayArrow, CheckCircle, Payments,
  WarningAmberRounded, ChatBubbleOutline,
} from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import EmployeeSummaryTab from '../components/EmployeeSummaryTab';
import TaxesDeductionsTab from '../components/TaxesDeductionsTab';
import CsvImportExport from '../components/CsvImportExport';
import CommentsPanel from '../components/CommentsPanel';

function fmtINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

// Status chip with semantic tokens
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

// Irreversible action confirmation dialog
function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel, busy, danger }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700 }}>
        <WarningAmberRounded sx={{ color: danger ? '#d32f2f' : '#b45309', fontSize: 22 }} />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>{body}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: 'var(--ink-secondary)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={busy}
          size="large"
          sx={{
            minWidth: 140,
            bgcolor: danger ? 'var(--brand-red)' : '#15803d',
            '&:hover': { bgcolor: danger ? 'var(--brand-red-hover)' : '#14532d' },
            fontWeight: 700,
          }}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Net-pay banner — ledger seal + stamp animation (Section 3)
// Seal uses the CSS `seal-stamp` keyframe already defined in index.css
// (opacity 0→1, scale 0.9→1, 250ms ease-out, 150ms delay) — no JS animation needed.
function NetPayBanner({ netPay }) {
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        bgcolor: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        p: '20px 24px',
        boxShadow: 'var(--shadow-card)',
        width: 'fit-content',
        minWidth: 240,
      }}
    >
      {/* Ledger seal — exact spec: 28px, ledger-seal colour, 1px inner ring.
          CSS seal-stamp animation handles the stamp-landing effect. */}
      <span
        className="ledger-seal"
        aria-hidden="true"
      />
      <Box>
        <Typography
          variant="caption"
          sx={{ color: 'var(--ink-secondary)', fontWeight: 500, display: 'block', mb: 0.25 }}
        >
          Net Pay
        </Typography>
        <Typography
          className="currency"
          sx={{ fontWeight: 700, fontSize: '1.75rem', color: 'var(--ink)', lineHeight: 1 }}
        >
          {fmtINR(netPay)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function PayrollRunDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user }  = useAuth();
  const isAdmin   = user?.role === 'Admin';

  const [run,     setRun]     = useState(null);
  const [slips,   setSlips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error,   setError]   = useState('');
  const [info,    setInfo]    = useState('');

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState(null); // { path, label, title, body, danger }

  // Tabs
  const [activeTab, setActiveTab] = useState(0);

  // Comments panel
  const [commentsOpen, setCommentsOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/payroll-runs/${id}`)
      .then(r => { setRun(r.data.run); setSlips(r.data.slips || []); })
      .catch(() => setError('Failed to load payroll run.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doAction = async () => {
    if (!confirmAction) return;
    setError(''); setInfo(''); setWorking(true);
    try {
      await api.post(`/payroll-runs/${id}/${confirmAction.path}`);
      setInfo(confirmAction.successMsg);
      setConfirmAction(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || `Failed.`);
      setConfirmAction(null);
    } finally {
      setWorking(false);
    }
  };


  if (loading) return (
    <Box>
      <Skeleton height={36} width={160} sx={{ mb: 2 }} />
      <Skeleton height={64} sx={{ mb: 1.5 }} />
      {[1, 2, 3].map(i => <Skeleton key={i} height={52} sx={{ mb: 0.75 }} />)}
    </Box>
  );

  const monthLabel = run
    ? new Date(run.year, run.month - 1)
        .toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    : '';


  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/payroll-runs')}
        sx={{ mb: 2, color: 'var(--ink-secondary)', fontWeight: 500 }}
      >
        Payroll Runs
      </Button>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
              {monthLabel}
            </Typography>
            <StatusChip status={run?.status} />
            <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
              {run?.employeeCount ?? 0} employees
            </Typography>
          </Box>
          {run?.notes && (
            <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.5 }}>
              {run.notes}
            </Typography>
          )}
        </Box>

        {/* View Notes button */}
        <Button
          variant="outlined"
          startIcon={<ChatBubbleOutline />}
          onClick={() => setCommentsOpen(true)}
          sx={{
            fontWeight: 600,
            color: 'var(--brand-red)',
            borderColor: 'var(--brand-red)',
            '&:hover': {
              borderColor: 'var(--brand-red)',
              bgcolor: 'rgba(220, 38, 38, 0.04)',
            },
          }}
        >
          View Notes
        </Button>

        {/* CSV Import/Export — available at all run statuses */}
        {isAdmin && <CsvImportExport run={run} onReload={load} />}

        {/* Action buttons — Admin only, state-driven, larger + confirming (irreversible) */}
        {isAdmin && run?.status === 'draft' && (
          <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
            <Button
              variant="outlined"
              startIcon={<PlayArrow />}
              disabled={working}
              size="large"
              onClick={() => setConfirmAction({
                path: 'generate',
                label: 'Generate Slips',
                title: 'Generate Salary Slips',
                body: 'This will compute and upload salary slips for all employees with financial profiles. You can re-generate before finalizing.',
                successMsg: 'Salary slips generated and uploaded.',
                danger: false,
              })}
              sx={{ fontWeight: 700, minWidth: 156 }}
            >
              Generate Slips
            </Button>
            {slips.length > 0 && (
              <Button
                variant="contained"
                startIcon={<CheckCircle />}
                disabled={working}
                size="large"
                onClick={() => setConfirmAction({
                  path: 'finalize',
                  label: 'Finalize Run',
                  title: 'Finalize Payroll Run',
                  body: 'Finalizing locks the run. No further changes to salary slips can be made. This action cannot be undone.',
                  successMsg: 'Run finalized.',
                  danger: false,
                })}
                sx={{ fontWeight: 700, minWidth: 140 }}
              >
                Finalize
              </Button>
            )}
          </Stack>
        )}

        {isAdmin && run?.status === 'finalized' && (
          <Button
            variant="contained"
            startIcon={<Payments />}
            disabled={working}
            size="large"
            onClick={() => setConfirmAction({
              path: 'mark-paid',
              label: 'Mark as Paid',
              title: 'Mark Run as Paid',
              body: 'This marks the payroll run as disbursed. The run will be permanently locked. This cannot be undone.',
              successMsg: 'Run marked as paid.',
              danger: true,
            })}
            sx={{
              fontWeight: 700, minWidth: 160,
              bgcolor: '#15803d',
              '&:hover': { bgcolor: '#14532d' },
            }}
          >
            Mark as Paid
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {info  && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

      {/* ── Totals row ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        {/* Gross pay */}
        <Box
          sx={{
            bgcolor: 'var(--paper)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', p: '16px 20px',
            boxShadow: 'var(--shadow-card)', minWidth: 160,
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ink-secondary)', fontWeight: 500 }}>
            Gross Pay
          </Typography>
          <Typography className="currency" sx={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', mt: 0.25 }}>
            {fmtINR(run?.totalGross)}
          </Typography>
        </Box>

        {/* Net pay — with ledger seal (Section 3: only on this banner) */}
        <NetPayBanner netPay={run?.totalNet} />
      </Stack>

      {/* ── Tabs ── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} aria-label="Payroll run tabs">
          <Tab label="Employee Summary" id="tab-0" aria-controls="tabpanel-0" />
          <Tab label="Taxes & Deductions" id="tab-1" aria-controls="tabpanel-1" />
        </Tabs>
      </Box>

      {/* Employee Summary Tab */}
      {activeTab === 0 && (
        <Box role="tabpanel" id="tabpanel-0" aria-labelledby="tab-0" sx={{ mt: 2 }}>
          <EmployeeSummaryTab
            run={run}
            slips={slips}
            isAdmin={isAdmin}
            onReload={load}
          />
        </Box>
      )}

      {/* Taxes & Deductions Tab */}
      {activeTab === 1 && (
        <Box role="tabpanel" id="tabpanel-1" aria-labelledby="tab-1" sx={{ mt: 2 }}>
          <TaxesDeductionsTab slips={slips} />
        </Box>
      )}

      {/* Confirm dialog — two-click for irreversible actions */}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={doAction}
        title={confirmAction?.title || ''}
        body={confirmAction?.body || ''}
        confirmLabel={confirmAction?.label || 'Confirm'}
        busy={working}
        danger={confirmAction?.danger}
      />

      {/* Comments Panel Drawer */}
      <CommentsPanel
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        run={run}
        onReload={load}
      />
    </Box>
  );
}
