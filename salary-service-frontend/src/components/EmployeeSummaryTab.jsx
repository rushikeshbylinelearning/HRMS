// src/components/EmployeeSummaryTab.jsx
//
// Employee Summary Tab for PayrollRunDetailPage.
// Renders a MUI Table with per-slip row actions via an overflow menu (MoreVert).
//
// Props:
//   run      — PayrollRun object (status, _id, etc.)
//   slips    — array of SalarySlip objects
//   isAdmin  — boolean
//   onReload — callback to reload run + slips from parent

import React, { useState } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import { MoreVert, Payments } from '@mui/icons-material';
import api from '../api/axios';
import {
  AddLopDialog,
  AddOneTimeEntryDialog,
  WithholdDialog,
  ReverseLopDialog,
  RecordPaymentDialog,
} from './SlipActionDialogs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

// Payment status chip
function PaymentStatusChip({ status }) {
  const isPaid = status === 'paid';
  return (
    <Chip
      label={isPaid ? 'Paid' : 'Pending'}
      size="small"
      sx={{
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.6875rem',
        fontWeight: 700,
        bgcolor: isPaid ? '#dcfce7' : '#f3f4f6',
        color: isPaid ? '#15803d' : '#6b7280',
      }}
    />
  );
}

// ─── TDS Sheet Dialog ─────────────────────────────────────────────────────────

function TdsSheetDialog({ open, onClose, tdsData }) {
  if (!tdsData) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>TDS Breakdown</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>Employee</Typography>
            <Typography variant="body2" fontWeight={600}>{tdsData.employeeName} ({tdsData.employeeId})</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>Gross Pay</Typography>
            <Typography variant="body2" className="currency" fontWeight={600}>{fmtINR(tdsData.grossPay)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>TDS Rate</Typography>
            <Typography variant="body2" fontWeight={600}>{tdsData.tdsRate ?? 0}%</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>TDS Amount</Typography>
            <Typography variant="body2" className="currency" fontWeight={600}>{fmtINR(tdsData.tdsAmount)}</Typography>
          </Box>
          {tdsData.deductions && (
            <>
              <Typography variant="caption" sx={{ color: 'var(--ink-secondary)', fontWeight: 600, mt: 1 }}>
                Deductions Breakdown
              </Typography>
              {Object.entries(tdsData.deductions).map(([key, val]) => (
                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', pl: 1 }}>
                  <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', textTransform: 'capitalize' }}>
                    {key.replace(/([A-Z])/g, ' $1')}
                  </Typography>
                  <Typography variant="body2" className="currency">{fmtINR(val)}</Typography>
                </Box>
              ))}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'var(--ink-secondary)' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Skip Confirmation Dialog ─────────────────────────────────────────────────

function SkipConfirmDialog({ open, onClose, onConfirm, slip, loading }) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Skip from Payroll</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
          This will exclude <strong>{slip?.employeeName || slip?.employeeId}</strong> from this
          payroll run's totals. This action can only be performed on a draft run.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: 'var(--ink-secondary)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          sx={{ minWidth: 100, fontWeight: 700, bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Skip'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Mark as Paid Toolbar ─────────────────────────────────────────────────────

function BulkMarkPaidToolbar({ selectedCount, onMarkPaid, busy }) {
  return (
    <Toolbar
      sx={{
        bgcolor: 'var(--paper)',
        borderBottom: '1px solid var(--border)',
        borderRadius: '0',
        px: 2,
        minHeight: '48px !important',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--ink)', flexGrow: 1 }}>
        {selectedCount} employee{selectedCount !== 1 ? 's' : ''} selected
      </Typography>
      <Button
        variant="contained"
        size="small"
        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <Payments />}
        onClick={onMarkPaid}
        disabled={busy}
        sx={{
          fontWeight: 700,
          bgcolor: '#15803d',
          '&:hover': { bgcolor: '#14532d' },
          minWidth: 130,
        }}
      >
        Mark as Paid
      </Button>
    </Toolbar>
  );
}

// ─── Overflow Menu ────────────────────────────────────────────────────────────

function SlipOverflowMenu({ anchorEl, slip, run, onClose, onAction }) {
  if (!slip) return null;

  const isDraft = run?.status === 'draft';
  const isWithheld = slip.withheld?.isWithheld === true;
  const isSkipped = slip.skipped === true;
  const hasLop =
    (slip.attendanceData?.lopDays > 0) ||
    (slip.lopAdjustments?.some(a => a.type === 'manual_addition'));

  const items = [
    { key: 'addLop',              label: 'Add LOP',                        show: isDraft },
    { key: 'addOneTime',          label: 'Add Earnings / Deductions',       show: isDraft },
    { key: 'withhold',            label: 'Withhold Salary',                 show: isDraft && !isWithheld },
    { key: 'release',             label: 'Release Withheld Salary',         show: isDraft && isWithheld },
    { key: 'skip',                label: 'Skip from Payroll',               show: isDraft && !isSkipped },
    { key: 'viewTds',             label: 'View TDS Sheet',                  show: true },
    { key: 'reverseLop',          label: 'Reverse LOP',                     show: isDraft && hasLop },
    { key: 'applyToNextRun',      label: 'Apply Correction to Next Run',    show: ['finalized', 'paid'].includes(run?.status) },
  ].filter(item => item.show);

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{ sx: { minWidth: 200, borderRadius: 'var(--radius-card)' } }}
    >
      {items.map(item => (
        <MenuItem
          key={item.key}
          onClick={() => { onAction(item.key); onClose(); }}
          dense
        >
          {item.label}
        </MenuItem>
      ))}
      {items.length === 0 && (
        <MenuItem disabled dense>No actions available</MenuItem>
      )}
    </Menu>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeSummaryTab({ run, slips, isAdmin, onReload }) {
  // Row selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Overflow menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeSlip, setActiveSlip] = useState(null);

  // Dialog states
  const [lopOpen, setLopOpen] = useState(false);
  const [oneTimeOpen, setOneTimeOpen] = useState(false);
  const [withholdOpen, setWithholdOpen] = useState(false);
  const [reverseLopOpen, setReverseLopOpen] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [skipError, setSkipError] = useState('');

  // TDS sheet dialog
  const [tdsDialogOpen, setTdsDialogOpen] = useState(false);
  const [tdsData, setTdsData] = useState(null);
  const [tdsLoading, setTdsLoading] = useState(false);

  // Bulk mark-paid
  const [bulkPaidBusy, setBulkPaidBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);

  // Arrears panel — tracks which slip has the inline panel open
  const [arrearsSlipId, setArrearsSlipId] = useState(null);

  // Apply correction to next run dialog (Phase 9)
  const [nextRunDialogOpen, setNextRunDialogOpen] = useState(false);
  const [nextRunDraftRuns,  setNextRunDraftRuns]  = useState([]);
  const [nextRunForm, setNextRunForm] = useState({ days: '', reason: '', nextRunId: '' });
  const [nextRunBusy, setNextRunBusy] = useState(false);
  const [nextRunError, setNextRunError] = useState('');

  // ── Selection handlers ────────────────────────────────────────────────────

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(slips.map(s => s._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (slipId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(slipId)) {
        next.delete(slipId);
      } else {
        next.add(slipId);
      }
      return next;
    });
  };

  const allSelected = slips.length > 0 && selectedIds.size === slips.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < slips.length;

  // ── Overflow menu handlers ────────────────────────────────────────────────

  const openMenu = (e, slip) => {
    setAnchorEl(e.currentTarget);
    setActiveSlip(slip);
  };

  const closeMenu = () => {
    setAnchorEl(null);
    // Keep activeSlip alive until dialogs close
  };

  const handleMenuAction = (key) => {
    switch (key) {
      case 'addLop':      setLopOpen(true);        break;
      case 'addOneTime':  setOneTimeOpen(true);     break;
      case 'withhold':    setWithholdOpen(true);    break;
      case 'release':     handleRelease();           break;
      case 'skip':        setSkipConfirmOpen(true); break;
      case 'viewTds':     loadTdsSheet();            break;
      case 'reverseLop':  setReverseLopOpen(true);  break;
      case 'applyToNextRun': handleOpenNextRunDialog(); break;
      default: break;
    }
  };

  // ── Release withheld salary (no dialog needed, direct call) ──────────────

  const handleRelease = async () => {
    if (!activeSlip || !run) return;
    try {
      await api.patch(`/payroll-runs/${run._id}/slips/${activeSlip._id}/release`);
      onReload();
    } catch (e) {
      // Silently fail — parent will reload anyway; user sees no change if it failed
      console.error('Release failed:', e);
    }
  };

  // ── Skip ──────────────────────────────────────────────────────────────────

  const handleSkipConfirm = async () => {
    if (!activeSlip || !run) return;
    setSkipLoading(true);
    setSkipError('');
    try {
      await api.patch(`/payroll-runs/${run._id}/slips/${activeSlip._id}/skip`);
      setSkipConfirmOpen(false);
      setActiveSlip(null);
      onReload();
    } catch (e) {
      setSkipError(e?.response?.data?.error || 'Failed to skip employee.');
    } finally {
      setSkipLoading(false);
    }
  };

  // ── TDS Sheet ─────────────────────────────────────────────────────────────

  const loadTdsSheet = async () => {
    if (!activeSlip || !run) return;
    setTdsLoading(true);
    setTdsData(null);
    setTdsDialogOpen(true);
    try {
      const res = await api.get(`/payroll-runs/${run._id}/slips/${activeSlip._id}/tds-sheet`);
      setTdsData(res.data);
    } catch (e) {
      setTdsData({ error: e?.response?.data?.error || 'Failed to load TDS sheet.' });
    } finally {
      setTdsLoading(false);
    }
  };

  // ── Bulk Mark as Paid ─────────────────────────────────────────────────────

  const handleBulkMarkPaid = async ({ paymentMode, paidAt, notifyEmployee }) => {
    setBulkPaidBusy(true);
    setBulkError('');
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(
        ids.map(slipId =>
          api.post(`/payroll-runs/${run._id}/slips/${slipId}/mark-paid`, {
            paymentMode,
            paidAt,
            notifyEmployee,
          })
        )
      );
      setSelectedIds(new Set());
      setRecordPaymentOpen(false);
      onReload();
    } catch (e) {
      setBulkError(e?.response?.data?.error || 'Some payments could not be recorded.');
    } finally {
      setBulkPaidBusy(false);
    }
  };

  // ── Dialog success ────────────────────────────────────────────────────────

  const handleDialogSuccess = () => {
    setActiveSlip(null);
    onReload();
  };

  // ── Apply correction to next run (Phase 9) ───────────────────────────────

  const handleOpenNextRunDialog = async () => {
    setNextRunForm({ days: '', reason: '', nextRunId: '' });
    setNextRunError('');
    setNextRunBusy(false);
    // Fetch draft runs for the dropdown
    try {
      const res = await api.get('/payroll-runs?status=draft');
      setNextRunDraftRuns(res.data.runs || []);
    } catch (e) {
      setNextRunDraftRuns([]);
    }
    setNextRunDialogOpen(true);
  };

  const handleApplyToNextRun = async () => {
    const { days, reason, nextRunId } = nextRunForm;
    if (!days || !reason || !nextRunId) {
      setNextRunError('All fields are required.');
      return;
    }
    if (!activeSlip || !run) return;
    setNextRunBusy(true);
    setNextRunError('');
    try {
      await api.post(
        `/payroll-runs/${run._id}/slips/${activeSlip._id}/apply-reversal-to-next-run`,
        { days: Number(days), reason, nextRunId }
      );
      setNextRunDialogOpen(false);
      setActiveSlip(null);
      onReload();
    } catch (e) {
      setNextRunError(e?.response?.data?.error || 'Failed to apply correction.');
    } finally {
      setNextRunBusy(false);
    }
  };

  // ── Arrears confirm / dismiss ─────────────────────────────────────────────

  const handleArrears = async (action, slip) => {
    try {
      await api.post(
        `/payroll-runs/${run._id}/slips/${slip._id}/${action === 'confirm' ? 'confirm-arrears' : 'dismiss-arrears'}`
      );
      setArrearsSlipId(null);
      onReload();
    } catch (e) {
      console.error('Arrears action failed:', e);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Box>
      {bulkError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBulkError('')}>
          {bulkError}
        </Alert>
      )}

      {skipError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSkipError('')}>
          {skipError}
        </Alert>
      )}

      <Paper
        sx={{
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Bulk selection toolbar — only when rows are selected */}
        {selectedIds.size > 0 && (
          <BulkMarkPaidToolbar
            selectedCount={selectedIds.size}
            onMarkPaid={() => setRecordPaymentOpen(true)}
            busy={bulkPaidBusy}
          />
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                    inputProps={{ 'aria-label': 'Select all employees' }}
                  />
                </TableCell>
                {['Employee', 'Gross Pay', 'LOP Days', 'Total Deductions', 'Net Pay', 'Payment Status', 'Actions'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {slips.map(slip => {
                const isSkipped = slip.skipped === true;
                const isWithheld = slip.withheld?.isWithheld === true;
                const rowColor = isSkipped ? 'var(--ink-muted)' : undefined;
                const lopDays = slip.attendanceData?.lopDays ?? 0;

                return (
                  <React.Fragment key={slip._id}>
                  <TableRow
                    hover={!isSkipped}
                    selected={selectedIds.has(slip._id)}
                    sx={{ color: rowColor }}
                  >
                    {/* Checkbox */}
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selectedIds.has(slip._id)}
                        onChange={() => handleSelectOne(slip._id)}
                        inputProps={{ 'aria-label': `Select ${slip.employeeName || slip.employeeId}` }}
                      />
                    </TableCell>

                    {/* Employee */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ color: rowColor ?? 'var(--ink)' }}
                          >
                            {slip.employeeName || slip.employeeId}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: rowColor ?? 'var(--ink-secondary)' }}
                          >
                            {slip.employeeId}
                          </Typography>
                        </Box>
                        {isWithheld && (
                          <Chip
                            label="Withheld"
                            size="small"
                            sx={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              bgcolor: '#fef3c7',
                              color: '#92400e',
                              borderRadius: 'var(--radius-pill)',
                            }}
                          />
                        )}
                        {isSkipped && (
                          <Chip
                            label="Skipped"
                            size="small"
                            sx={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              bgcolor: '#f3f4f6',
                              color: 'var(--ink-muted)',
                              borderRadius: 'var(--radius-pill)',
                            }}
                          />
                        )}
                        {/* Arrears Pending chip — Phase 8 */}
                        {slip.pendingArrearsSuggestion?.dismissed === false &&
                          slip.pendingArrearsSuggestion?.amount > 0 && (
                          <Chip
                            label="Arrears Pending"
                            size="small"
                            onClick={() => setArrearsSlipId(prev => prev === slip._id ? null : slip._id)}
                            sx={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              bgcolor: '#fef3c7',
                              color: '#92400e',
                              borderRadius: 'var(--radius-pill)',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#fde68a' },
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    {/* Gross Pay */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        className="currency"
                        sx={{ color: rowColor ?? 'var(--ink-secondary)' }}
                      >
                        {fmtINR(slip.grossPay)}
                      </Typography>
                    </TableCell>

                    {/* LOP Days */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ color: rowColor ?? 'var(--ink-secondary)' }}
                      >
                        {lopDays}
                      </Typography>
                    </TableCell>

                    {/* Total Deductions */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        className="currency"
                        sx={{ color: rowColor ?? 'var(--ink-secondary)' }}
                      >
                        {fmtINR(slip.totalDeductions)}
                      </Typography>
                    </TableCell>

                    {/* Net Pay */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        className="currency"
                        fontWeight={700}
                        sx={{ color: rowColor ?? 'var(--ink)' }}
                      >
                        {fmtINR(slip.netPay)}
                      </Typography>
                    </TableCell>

                    {/* Payment Status */}
                    <TableCell>
                      <PaymentStatusChip status={slip.paymentStatus} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <Tooltip title="More actions">
                        <IconButton
                          size="small"
                          onClick={(e) => openMenu(e, slip)}
                          aria-label={`Actions for ${slip.employeeName || slip.employeeId}`}
                          aria-haspopup="true"
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>

                  {/* Arrears inline panel — shown when chip is clicked */}
                  {arrearsSlipId === slip._id &&
                    slip.pendingArrearsSuggestion?.amount > 0 && (
                    <TableRow key={`arrears-${slip._id}`}>
                      <TableCell colSpan={8} sx={{ py: 0 }}>
                        <Box sx={{
                          m: 1,
                          p: 2,
                          bgcolor: '#fffbeb',
                          border: '1px solid #fbbf24',
                          borderRadius: 'var(--radius-card)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          flexWrap: 'wrap',
                        }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight={600} sx={{ color: '#92400e' }}>
                              New Joinee Arrears Suggestion
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#92400e' }}>
                              Suggested amount:{' '}
                              <strong className="currency">
                                {fmtINR(slip.pendingArrearsSuggestion.amount)}
                              </strong>
                            </Typography>
                            {slip.pendingArrearsSuggestion.reason && (
                              <Typography variant="caption" sx={{ color: '#92400e' }}>
                                {slip.pendingArrearsSuggestion.reason}
                              </Typography>
                            )}
                          </Box>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleArrears('confirm', slip)}
                            sx={{ bgcolor: '#15803d', '&:hover': { bgcolor: '#14532d' }, fontWeight: 700 }}
                          >
                            Add to Slip
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleArrears('dismiss', slip)}
                            sx={{ color: '#92400e', borderColor: '#f59e0b', '&:hover': { borderColor: '#d97706' } }}
                          >
                            Dismiss
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })}

              {slips.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Box sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No salary slips yet.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Overflow Menu ── */}
      <SlipOverflowMenu
        anchorEl={anchorEl}
        slip={activeSlip}
        run={run}
        onClose={closeMenu}
        onAction={handleMenuAction}
      />

      {/* ── Dialogs ── */}

      {/* Add LOP */}
      <AddLopDialog
        open={lopOpen}
        onClose={() => { setLopOpen(false); setActiveSlip(null); }}
        onSuccess={handleDialogSuccess}
        slip={activeSlip}
        run={run}
      />

      {/* Add Earnings / Deductions */}
      <AddOneTimeEntryDialog
        open={oneTimeOpen}
        onClose={() => { setOneTimeOpen(false); setActiveSlip(null); }}
        onSuccess={handleDialogSuccess}
        slip={activeSlip}
        run={run}
      />

      {/* Withhold */}
      <WithholdDialog
        open={withholdOpen}
        onClose={() => { setWithholdOpen(false); setActiveSlip(null); }}
        onSuccess={handleDialogSuccess}
        slip={activeSlip}
        run={run}
      />

      {/* Reverse LOP */}
      <ReverseLopDialog
        open={reverseLopOpen}
        onClose={() => { setReverseLopOpen(false); setActiveSlip(null); }}
        onSuccess={handleDialogSuccess}
        slip={activeSlip}
        run={run}
      />

      {/* Skip Confirmation */}
      <SkipConfirmDialog
        open={skipConfirmOpen}
        onClose={() => { setSkipConfirmOpen(false); setSkipError(''); }}
        onConfirm={handleSkipConfirm}
        slip={activeSlip}
        loading={skipLoading}
      />

      {/* TDS Sheet */}
      <TdsSheetDialog
        open={tdsDialogOpen}
        onClose={() => { setTdsDialogOpen(false); setTdsData(null); setActiveSlip(null); }}
        tdsData={tdsLoading ? null : tdsData}
      />

      {/* TDS loading indicator */}
      {tdsDialogOpen && tdsLoading && (
        <Dialog open maxWidth="xs" fullWidth>
          <DialogContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </DialogContent>
        </Dialog>
      )}

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={recordPaymentOpen}
        onClose={() => { setRecordPaymentOpen(false); setBulkError(''); }}
        onConfirm={handleBulkMarkPaid}
        loading={bulkPaidBusy}
        error={bulkError}
      />

      {/* Apply Correction to Next Run Dialog — Phase 9 */}
      <Dialog
        open={nextRunDialogOpen}
        onClose={nextRunBusy ? undefined : () => setNextRunDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Apply Correction to Next Run</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {nextRunError && <Alert severity="error" sx={{ mb: 0 }}>{nextRunError}</Alert>}

          <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', fontStyle: 'italic' }}>
            Corrections to finalized runs are applied to the employee's next pay run. This will not change the paid slip or its PDF.
          </Typography>

          <TextField
            label="LOP Days to Correct"
            type="number"
            inputProps={{ min: 0.5, step: 0.5 }}
            value={nextRunForm.days}
            onChange={e => setNextRunForm(f => ({ ...f, days: e.target.value }))}
            disabled={nextRunBusy}
            required
            fullWidth
            size="small"
            helperText="Days to add back (positive correction)"
          />

          <TextField
            label="Reason"
            value={nextRunForm.reason}
            onChange={e => setNextRunForm(f => ({ ...f, reason: e.target.value }))}
            disabled={nextRunBusy}
            required
            fullWidth
            size="small"
            multiline
            minRows={2}
            placeholder={`e.g. Correction for ${run ? new Date(run.year, run.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) : 'prior'} run`}
          />

          <FormControl fullWidth size="small" required>
            <InputLabel id="next-run-select-label">Target Draft Run</InputLabel>
            <Select
              labelId="next-run-select-label"
              value={nextRunForm.nextRunId}
              label="Target Draft Run"
              onChange={e => setNextRunForm(f => ({ ...f, nextRunId: e.target.value }))}
              disabled={nextRunBusy}
            >
              {nextRunDraftRuns.length === 0 ? (
                <MenuItem disabled value="">No draft runs available</MenuItem>
              ) : (
                nextRunDraftRuns.map(r => {
                  const label = new Date(r.year, r.month - 1)
                    .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
                  return (
                    <MenuItem key={r._id} value={r._id}>
                      {label} (draft)
                    </MenuItem>
                  );
                })
              )}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setNextRunDialogOpen(false)}
            disabled={nextRunBusy}
            sx={{ color: 'var(--ink-secondary)' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApplyToNextRun}
            disabled={nextRunBusy || !nextRunForm.days || !nextRunForm.reason || !nextRunForm.nextRunId}
            sx={{ minWidth: 160, fontWeight: 700 }}
          >
            {nextRunBusy ? <CircularProgress size={18} color="inherit" /> : 'Apply Correction'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
