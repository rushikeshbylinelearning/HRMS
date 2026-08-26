// src/pages/FinancialProfilesPage.jsx
// Sensitive fields (bank account, PAN, UAN) are masked by default — show last 4 only.
// An explicit "reveal" icon click shows the full value (client-side display only).
// A small Lock icon signals "sensitive field" per the design brief.
// All salary figures use .currency (tabular-nums).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Alert, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControlLabel, Switch, InputAdornment,
  Tooltip, IconButton, Stack, Divider, Skeleton,
} from '@mui/material';
import {
  Add, Edit, Sync, Search, CheckCircle, Warning,
  LockOutlined, VisibilityOutlined, VisibilityOffOutlined,
} from '@mui/icons-material';
import api from '../api/axios';

function fmtINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

// ─── Masked sensitive value ──────────────────────────────────────────────────
// Shows ••••XXXX by default; reveal icon toggles to full value.
// Records the reveal in a client-side hint (server already audits server-side).
function MaskedField({ value, label }) {
  const [revealed, setRevealed] = useState(false);

  if (!value) return <Typography variant="body2" sx={{ color: 'var(--ink-muted)' }}>—</Typography>;

  const masked = '••••' + String(value).slice(-4);
  const display = revealed ? String(value) : masked;

  const handleReveal = () => {
    setRevealed(v => !v);
    if (!revealed) {
      // Client-side hint — audit event is logged server-side on FINANCIAL_PROFILE_UPDATED
      console.info(`[payroll-ui] Sensitive field revealed: ${label}`);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <LockOutlined sx={{ fontSize: 12, color: 'var(--ink-muted)', flexShrink: 0 }} />
      <Typography
        variant="body2"
        className="sensitive-field"
        sx={{
          fontFamily: revealed ? 'inherit' : '"SFMono-Regular", Consolas, monospace',
          fontSize: '0.8125rem',
          color: revealed ? 'var(--ink)' : 'var(--ink-secondary)',
          letterSpacing: revealed ? 'normal' : '0.06em',
        }}
      >
        {display}
      </Typography>
      <Tooltip title={revealed ? 'Hide' : 'Reveal'} placement="top">
        <IconButton
          size="small"
          onClick={handleReveal}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          sx={{ p: '2px', color: 'var(--ink-muted)', '&:hover': { color: 'var(--ink)' } }}
        >
          {revealed
            ? <VisibilityOffOutlined sx={{ fontSize: 13 }} />
            : <VisibilityOutlined    sx={{ fontSize: 13 }} />
          }
        </IconButton>
      </Tooltip>
    </Box>
  );
}

const EMPTY_FORM = {
  employeeId: '', employeeName: '',
  bankAccountNumber: '', ifscCode: '', panNumber: '', uan: '',
  ctc: '', basicSalary: '', hra: '', allowances: '',
  useFixedSalary: false,
};

export default function FinancialProfilesPage() {
  const [profiles,        setProfiles]        = useState([]);
  const [amsEmployees,    setAmsEmployees]     = useState([]);
  const [loadingProfiles, setLoadingProfiles]  = useState(true);
  const [loadingEmployees,setLoadingEmployees] = useState(false);
  const [error,           setError]            = useState('');
  const [info,            setInfo]             = useState('');
  const [search,          setSearch]           = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode,   setEditMode]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [formData,   setFormData]   = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  const loadProfiles = useCallback(() => {
    setLoadingProfiles(true);
    api.get('/financial-profiles')
      .then(r => setProfiles(r.data.profiles || []))
      .catch(() => setError('Failed to load financial profiles.'))
      .finally(() => setLoadingProfiles(false));
  }, []);

  const syncEmployees = useCallback(() => {
    setLoadingEmployees(true);
    setError('');
    api.get('/financial-profiles/sync/employees')
      .then(r => {
        setAmsEmployees(r.data.employees || []);
        setInfo(`Loaded ${r.data.count} employees from attendance portal.`);
        setTimeout(() => setInfo(''), 4000);
      })
      .catch(e => setError(
        e.response?.data?.details
          ? `Could not reach attendance portal: ${e.response.data.details}`
          : 'Failed to sync employees from the attendance portal.'
      ))
      .finally(() => setLoadingEmployees(false));
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const profileMap = useMemo(() => {
    const m = {};
    profiles.forEach(p => { m[p.employeeId] = p; });
    return m;
  }, [profiles]);

  const mergedList = useMemo(() => {
    const list = amsEmployees.map(emp => ({ ...emp, profile: profileMap[emp.employeeId] || null }));
    profiles.forEach(p => {
      if (!amsEmployees.find(e => e.employeeId === p.employeeId)) {
        list.push({
          employeeId: p.employeeId, fullName: p.employeeName || p.employeeId,
          department: '', designation: '', isActive: p.isActive, profile: p,
        });
      }
    });
    return list;
  }, [amsEmployees, profileMap, profiles]);

  const filteredList = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return mergedList;
    return mergedList.filter(e =>
      e.fullName?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q)
    );
  }, [mergedList, search]);

  function openCreate(emp) {
    setEditMode(false); setFormErrors({});
    setFormData({ ...EMPTY_FORM, employeeId: emp?.employeeId || '', employeeName: emp?.fullName || '' });
    setDialogOpen(true);
  }
  function openEdit(profile) {
    setEditMode(true); setFormErrors({});
    setFormData({
      employeeId: profile.employeeId, employeeName: profile.employeeName || '',
      bankAccountNumber: profile.bankAccountNumber || '', ifscCode: profile.ifscCode || '',
      panNumber: profile.panNumber || '', uan: profile.uan || '',
      ctc: profile.ctc || '', basicSalary: profile.basicSalary || '',
      hra: profile.hra || '', allowances: profile.allowances || '',
      useFixedSalary: profile.useFixedSalary || false,
    });
    setDialogOpen(true);
  }
  function handleFieldChange(e) {
    const { name, value, checked, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  }
  function validate() {
    const errs = {};
    if (!formData.employeeId.trim()) errs.employeeId = 'Employee ID is required';
    ['ctc','basicSalary','hra','allowances'].forEach(k => {
      if (formData[k] !== '' && isNaN(Number(formData[k]))) errs[k] = 'Must be a number';
    });
    return errs;
  }
  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true); setError('');
    const payload = {
      employeeId:        formData.employeeId.trim(),
      employeeName:      formData.employeeName.trim(),
      bankAccountNumber: formData.bankAccountNumber.trim() || undefined,
      ifscCode:          formData.ifscCode.trim() || undefined,
      panNumber:         formData.panNumber.trim().toUpperCase() || undefined,
      uan:               formData.uan.trim() || undefined,
      ctc:               formData.ctc !== '' ? Number(formData.ctc) : undefined,
      basicSalary:       formData.basicSalary !== '' ? Number(formData.basicSalary) : undefined,
      hra:               formData.hra !== '' ? Number(formData.hra) : undefined,
      allowances:        formData.allowances !== '' ? Number(formData.allowances) : undefined,
      useFixedSalary:    formData.useFixedSalary,
    };
    try {
      if (editMode) {
        await api.put(`/financial-profiles/${payload.employeeId}`, payload);
      } else {
        await api.post('/financial-profiles', payload);
      }
      setDialogOpen(false);
      loadProfiles();
      setInfo(`Profile ${editMode ? 'updated' : 'created'} successfully.`);
      setTimeout(() => setInfo(''), 4000);
    } catch (e) {
      setError(e.response?.data?.error || `Failed to ${editMode ? 'update' : 'create'} profile.`);
    } finally {
      setSaving(false);
    }
  }

  const showSyncPrompt = !loadingProfiles && !loadingEmployees && amsEmployees.length === 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
            Employee Financial Profiles
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.25 }}>
            Sensitive fields are masked — click the lock icon to reveal.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Button
            variant="outlined"
            startIcon={loadingEmployees ? <CircularProgress size={16} /> : <Sync />}
            disabled={loadingEmployees}
            onClick={syncEmployees}
          >
            Sync from Attendance
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => openCreate(null)}
            sx={{ bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
          >
            Add Profile
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {info  && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

      {showSyncPrompt && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Click <strong>"Sync from Attendance"</strong> to load employees from the attendance system.
        </Alert>
      )}

      {/* Stats */}
      {mergedList.length > 0 && (
        <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
          {[
            { label: 'Total Employees',  value: mergedList.length,                       color: 'var(--ink)' },
            { label: 'With Profile',     value: profiles.length,                         color: 'var(--status-paid)' },
            { label: 'Without Profile',  value: mergedList.length - profiles.length,     color: 'var(--status-finalized)' },
          ].map(s => (
            <Box key={s.label}>
              <Typography variant="caption" sx={{ color: 'var(--ink-secondary)', display: 'block' }}>{s.label}</Typography>
              <Typography variant="h6" className="currency" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
            </Box>
          ))}
        </Stack>
      )}

      {/* Search */}
      {mergedList.length > 0 && (
        <TextField
          fullWidth size="small"
          placeholder="Search by name, employee ID, or department…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" sx={{ color: 'var(--ink-muted)' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
      )}

      {loadingProfiles ? (
        <Box>{[1,2,3,4].map(i => <Skeleton key={i} height={52} sx={{ mb: 0.5 }} />)}</Box>
      ) : mergedList.length > 0 ? (
        <Paper sx={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Employee','Department','Bank Account','PAN','CTC','Basic','Profile','Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredList.map(emp => {
                  const p = emp.profile;
                  return (
                    <TableRow key={emp.employeeId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--ink)' }}>
                          {emp.fullName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--ink-secondary)' }}>
                          {emp.employeeId}
                        </Typography>
                        {emp.designation && (
                          <Typography variant="caption" sx={{ color: 'var(--ink-muted)', display: 'block' }}>
                            {emp.designation}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
                          {emp.department || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {p ? <MaskedField value={p.bankAccountNumber} label="bank account" /> : <Typography variant="body2" sx={{ color: 'var(--ink-muted)' }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        {p ? <MaskedField value={p.panNumber} label="PAN" /> : <Typography variant="body2" sx={{ color: 'var(--ink-muted)' }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        {p
                          ? <Typography variant="body2" className="currency" sx={{ color: 'var(--ink-secondary)' }}>{fmtINR(p.ctc)}</Typography>
                          : <Typography variant="body2" sx={{ color: 'var(--ink-muted)' }}>—</Typography>
                        }
                      </TableCell>
                      <TableCell>
                        {p
                          ? <Typography variant="body2" className="currency" sx={{ fontWeight: 600, color: 'var(--ink)' }}>{fmtINR(p.basicSalary)}</Typography>
                          : <Typography variant="body2" sx={{ color: 'var(--ink-muted)' }}>—</Typography>
                        }
                      </TableCell>
                      <TableCell>
                        {p ? (
                          <Tooltip title="Financial profile exists">
                            <CheckCircle sx={{ color: 'var(--status-paid)', fontSize: 18 }} />
                          </Tooltip>
                        ) : (
                          <Tooltip title="No financial profile">
                            <Warning sx={{ color: 'var(--status-finalized)', fontSize: 18 }} />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        {p ? (
                          <Tooltip title="Edit profile">
                            <IconButton size="small" onClick={() => openEdit(p)} aria-label="Edit financial profile">
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Button
                            size="small" variant="outlined" startIcon={<Add />}
                            onClick={() => openCreate(emp)}
                            sx={{ fontSize: '0.75rem', borderRadius: 'var(--radius-control)' }}
                          >
                            Add
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary" sx={{ py: 2 }}>No employees match your search.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : null}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editMode ? 'Edit Financial Profile' : 'Add Financial Profile'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Employee ID" name="employeeId" value={formData.employeeId}
              onChange={handleFieldChange} disabled={editMode}
              error={!!formErrors.employeeId} helperText={formErrors.employeeId}
              required fullWidth size="small"
            />
            <TextField
              label="Employee Name" name="employeeName" value={formData.employeeName}
              onChange={handleFieldChange} fullWidth size="small"
            />

            <Divider><Typography variant="caption" sx={{ color: 'var(--ink-secondary)' }}>Salary Structure</Typography></Divider>

            <Stack direction="row" spacing={2}>
              <TextField
                label="CTC (Annual)" name="ctc" value={formData.ctc}
                onChange={handleFieldChange} error={!!formErrors.ctc} helperText={formErrors.ctc}
                fullWidth size="small"
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
              <TextField
                label="Basic Salary" name="basicSalary" value={formData.basicSalary}
                onChange={handleFieldChange} error={!!formErrors.basicSalary} helperText={formErrors.basicSalary}
                fullWidth size="small"
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="HRA" name="hra" value={formData.hra}
                onChange={handleFieldChange} error={!!formErrors.hra} helperText={formErrors.hra}
                fullWidth size="small"
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
              <TextField
                label="Allowances" name="allowances" value={formData.allowances}
                onChange={handleFieldChange} error={!!formErrors.allowances} helperText={formErrors.allowances}
                fullWidth size="small"
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Stack>
            <FormControlLabel
              control={<Switch checked={formData.useFixedSalary} onChange={handleFieldChange} name="useFixedSalary" />}
              label="Use fixed salary (override payroll settings percentages)"
            />

            <Divider>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <LockOutlined sx={{ fontSize: 13, color: 'var(--ink-muted)' }} />
                <Typography variant="caption" sx={{ color: 'var(--ink-secondary)' }}>Banking &amp; Tax Details</Typography>
              </Box>
            </Divider>

            <TextField
              label="Bank Account Number" name="bankAccountNumber" value={formData.bankAccountNumber}
              onChange={handleFieldChange} fullWidth size="small"
              autoComplete="off" inputProps={{ autoComplete: 'off' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ fontSize: 14, color: 'var(--ink-muted)' }} />
                  </InputAdornment>
                ),
              }}
              helperText="Stored encrypted at rest"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="IFSC Code" name="ifscCode" value={formData.ifscCode}
                onChange={handleFieldChange} fullWidth size="small"
              />
              <TextField
                label="PAN Number" name="panNumber" value={formData.panNumber}
                onChange={handleFieldChange} fullWidth size="small"
                inputProps={{ style: { textTransform: 'uppercase' } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ fontSize: 14, color: 'var(--ink-muted)' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
            <TextField
              label="UAN (PF Account)" name="uan" value={formData.uan}
              onChange={handleFieldChange} fullWidth size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ fontSize: 14, color: 'var(--ink-muted)' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
            sx={{ bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
          >
            {saving ? 'Saving…' : editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
