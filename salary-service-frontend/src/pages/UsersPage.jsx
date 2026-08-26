// src/pages/UsersPage.jsx — Admin only: manage payroll system users
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, Skeleton, Select, InputLabel, FormControl, Divider,
} from '@mui/material';
import { Add, LockReset, PersonOff, PersonAdd } from '@mui/icons-material';
import api from '../api/axios';

// ── Role chip ─────────────────────────────────────────────────────────────────
function RoleChip({ role }) {
  const isAdmin = role === 'Admin';
  return (
    <Chip
      label={isAdmin ? 'Admin' : 'Payroll Officer'}
      size="small"
      sx={{
        backgroundColor: isAdmin ? 'var(--brand-red-tint)' : '#f3f4f6',
        color:           isAdmin ? 'var(--brand-red)'      : 'var(--ink-secondary)',
        fontWeight: 600,
        fontSize: '0.75rem',
        borderRadius: 'var(--radius-pill)',
        height: 22,
      }}
    />
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────
function StatusChip({ active }) {
  return (
    <Chip
      label={active ? 'Active' : 'Inactive'}
      size="small"
      sx={{
        backgroundColor: active ? 'var(--status-paid-tint)' : '#f3f4f6',
        color:           active ? 'var(--status-paid)'      : 'var(--status-draft)',
        fontWeight: 600,
        fontSize: '0.75rem',
        borderRadius: 'var(--radius-pill)',
        height: 22,
      }}
    />
  );
}

const TABLE_HEADERS = ['Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'];

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [info,    setInfo]    = useState('');

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form,       setForm]       = useState({ email: '', password: '', role: 'PayrollOfficer', fullName: '' });
  const [saving,     setSaving]     = useState(false);
  const [formErr,    setFormErr]    = useState('');

  // Reset password dialog
  const [resetUser,  setResetUser]  = useState(null);
  const [newPwd,     setNewPwd]     = useState('');
  const [resetBusy,  setResetBusy]  = useState(false);
  const [resetErr,   setResetErr]   = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users')
      .then(r => setUsers(r.data.users || []))
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setFormErr('');
    if (!form.email.trim() || !form.password) {
      setFormErr('Email and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setFormErr('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', form);
      setCreateOpen(false);
      setForm({ email: '', password: '', role: 'PayrollOfficer', fullName: '' });
      setInfo('User created successfully.');
      load();
    } catch (e) {
      setFormErr(e.response?.data?.error || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    setResetErr('');
    if (newPwd.length < 8) {
      setResetErr('Password must be at least 8 characters.');
      return;
    }
    setResetBusy(true);
    try {
      await api.post(`/users/${resetUser._id}/reset-password`, { newPassword: newPwd });
      setInfo(`Password reset for ${resetUser.email}.`);
      setResetUser(null);
      setNewPwd('');
    } catch (e) {
      setResetErr(e.response?.data?.error || 'Failed to reset password.');
    } finally {
      setResetBusy(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u._id}`, { isActive: !u.isActive });
      setInfo(`User ${u.isActive ? 'deactivated' : 'activated'}.`);
      load();
    } catch {
      setError('Failed to update user status.');
    }
  };

  const fForm = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const closeCreate = () => {
    setCreateOpen(false);
    setFormErr('');
    setForm({ email: '', password: '', role: 'PayrollOfficer', fullName: '' });
  };

  const closeReset = () => {
    setResetUser(null);
    setNewPwd('');
    setResetErr('');
  };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
            Payroll Users
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.5 }}>
            Manage accounts with access to this payroll system
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
          sx={{
            backgroundColor: 'var(--brand-red)',
            '&:hover': { backgroundColor: 'var(--brand-red-hover)' },
            borderRadius: 'var(--radius-control)',
            fontWeight: 600,
          }}
        >
          Add User
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 'var(--radius-control)' }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}
      {info && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: 'var(--radius-control)' }}
          onClose={() => setInfo('')}
        >
          {info}
        </Alert>
      )}

      {/* Users table */}
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
              {TABLE_HEADERS.map(h => (
                <TableCell
                  key={h}
                  sx={{
                    backgroundColor: 'var(--sidebar-navy-deep)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    borderBottom: 'none',
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
              ? [1, 2, 3].map(i => (
                <TableRow key={i}>
                  {[1, 2, 3, 4, 5, 6].map(j => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
              : users.map(u => (
                <TableRow key={u._id} hover>
                  <TableCell sx={{ py: 1.5, fontWeight: 500, color: 'var(--ink)' }}>
                    {u.fullName || '—'}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, color: 'var(--ink)' }}>
                    {u.email}
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <RoleChip role={u.role} />
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <StatusChip active={u.isActive} />
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'var(--ink-secondary)' }}>
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })
                        : 'Never'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Tooltip title="Reset password">
                      <IconButton
                        size="small"
                        onClick={() => { setResetUser(u); setNewPwd(''); setResetErr(''); }}
                        sx={{ color: 'var(--ink-secondary)', mr: 0.5 }}
                      >
                        <LockReset fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={u.isActive ? 'Deactivate user' : 'Activate user'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleActive(u)}
                        sx={{ color: u.isActive ? 'var(--status-finalized)' : 'var(--status-paid)' }}
                      >
                        {u.isActive ? <PersonOff fontSize="small" /> : <PersonAdd fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            }
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
                    No users found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Create User dialog ─────────────────────────────────────────────── */}
      <Dialog open={createOpen} onClose={closeCreate} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Add Payroll User</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <Alert
            severity="info"
            sx={{ mb: 2.5, fontSize: '0.8125rem', borderRadius: 'var(--radius-control)' }}
          >
            This creates an account in the payroll system only — separate from AMS.
          </Alert>
          {formErr && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--radius-control)' }}>
              {formErr}
            </Alert>
          )}
          <TextField
            label="Full name"
            value={form.fullName}
            onChange={e => fForm('fullName', e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={e => fForm('email', e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            required
          />
          <TextField
            label="Password (min 8 characters)"
            type="password"
            value={form.password}
            onChange={e => fForm('password', e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            required
            autoComplete="new-password"
          />
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select value={form.role} label="Role" onChange={e => fForm('role', e.target.value)}>
              <MenuItem value="PayrollOfficer">Payroll Officer</MenuItem>
              <MenuItem value="Admin">Admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeCreate} sx={{ color: 'var(--ink-secondary)' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving}
            sx={{
              backgroundColor: 'var(--brand-red)',
              '&:hover': { backgroundColor: 'var(--brand-red-hover)' },
              fontWeight: 600,
              minWidth: 120,
            }}
          >
            {saving ? 'Creating…' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reset Password dialog ─────────────────────────────────────────── */}
      <Dialog open={Boolean(resetUser)} onClose={closeReset} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Reset Password
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography variant="body2" sx={{ mb: 2, color: 'var(--ink-secondary)' }}>
            Setting a new password for{' '}
            <strong style={{ color: 'var(--ink)' }}>{resetUser?.email}</strong>.
            The user will need to use this password on their next login.
          </Typography>
          {resetErr && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 'var(--radius-control)' }}>
              {resetErr}
            </Alert>
          )}
          <TextField
            label="New password (min 8 characters)"
            type="password"
            value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            fullWidth
            size="small"
            autoComplete="new-password"
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeReset} sx={{ color: 'var(--ink-secondary)' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleResetPassword}
            disabled={resetBusy}
            sx={{
              backgroundColor: 'var(--brand-red)',
              '&:hover': { backgroundColor: 'var(--brand-red-hover)' },
              fontWeight: 600,
              minWidth: 120,
            }}
          >
            {resetBusy ? 'Saving…' : 'Reset Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
