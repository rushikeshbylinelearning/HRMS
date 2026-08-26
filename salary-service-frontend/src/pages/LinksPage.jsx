// src/pages/LinksPage.jsx
// "Shown once" constraint — token URL shown in a dedicated red-tinted modal,
// not a dismissable toast. The warning banner is impossible to miss.
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, Skeleton, FormControl, InputLabel, Select,
} from '@mui/material';
import { Add, Block, ContentCopy, WarningAmberRounded, LinkOff } from '@mui/icons-material';
import api from '../api/axios';

const EXPIRY_OPTIONS = [
  { label: '24 hours', value: '24h' },
  { label: '7 days',   value: '7d'  },
  { label: '30 days',  value: '30d' },
];

function LinkStatusChip({ link }) {
  const expired = new Date(link.expiresAt) < new Date();
  if (link.revoked || expired) {
    return (
      <Chip
        label={link.revoked ? 'Revoked' : 'Expired'}
        size="small"
        sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 700, borderRadius: 'var(--radius-pill)', fontSize: '0.6875rem' }}
      />
    );
  }
  return (
    <Chip
      label="Active"
      size="small"
      sx={{ bgcolor: 'var(--status-paid-tint)', color: 'var(--status-paid)', fontWeight: 700, borderRadius: 'var(--radius-pill)', fontSize: '0.6875rem' }}
    />
  );
}

export default function LinksPage() {
  const [links,   setLinks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [info,    setInfo]    = useState('');
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [copied,  setCopied]  = useState(null);
  const [newLink, setNewLink] = useState(null);

  const [form, setForm] = useState({
    resourceType: 'salarySlip', resourceKey: '', permission: 'view',
    recipientLabel: '', expiryPreset: '7d', maxUses: '1',
  });
  const [formErr, setFormErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/links')
      .then(r => setLinks(r.data.links || []))
      .catch(() => setError('Failed to load links.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setFormErr('');
    if (!form.resourceKey.trim()) { setFormErr('Resource key / B2 path is required.'); return; }
    setSaving(true);
    try {
      const res = await api.post('/links', {
        resourceType:   form.resourceType,
        resourceKey:    form.resourceKey.trim(),
        permission:     form.permission,
        recipientLabel: form.recipientLabel.trim(),
        expiryPreset:   form.expiryPreset,
        maxUses:        parseInt(form.maxUses, 10) || 1,
        resourceLabel:  form.resourceKey.trim().split('/').pop(),
      });
      setNewLink(res.data.link);
      load();
    } catch (e) {
      setFormErr(e.response?.data?.error || 'Failed to create link.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      await api.post(`/links/${id}/revoke`);
      setInfo('Link revoked.');
      setTimeout(() => setInfo(''), 3000);
      load();
    } catch { setError('Failed to revoke link.'); }
  };

  const copyUrl = (token) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const f = (key, val) => setForm(s => ({ ...s, [key]: val }));

  const closeCreateDialog = () => { setOpen(false); setNewLink(null); setFormErr(''); };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>Share Links</Typography>
          <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.25 }}>
            Timed external access links for salary slips and documents.
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />}
          onClick={() => { setNewLink(null); setFormErr(''); setOpen(true); }}
          sx={{ bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
        >
          Create Link
        </Button>
      </Box>

      {error && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {info  && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo('')}>{info}</Alert>}

      <Paper sx={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Resource','Recipient','Permission','Expiry','Uses','Status','Actions'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6,7].map(j => <TableCell key={j}><Skeleton height={20} /></TableCell>)}
                  </TableRow>
                ))
                : links.map(link => {
                  const expired = new Date(link.expiresAt) < new Date();
                  return (
                    <TableRow key={link._id} hover>
                      <TableCell>
                        <Typography
                          variant="body2" fontWeight={600}
                          sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}
                        >
                          {link.resourceLabel || link.resourceKey}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--ink-secondary)' }}>
                          {link.resourceType}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
                          {link.recipientLabel || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={link.permission} size="small"
                          sx={{
                            borderRadius: 'var(--radius-pill)', fontSize: '0.6875rem', fontWeight: 600,
                            bgcolor: link.permission === 'download' ? '#dbeafe' : '#f3f4f6',
                            color:   link.permission === 'download' ? '#1e40af' : '#374151',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
                          {new Date(link.expiresAt).toLocaleDateString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" className="currency" sx={{ color: 'var(--ink-secondary)' }}>
                          {link.useCount ?? 0} / {link.maxUses}
                        </Typography>
                      </TableCell>
                      <TableCell><LinkStatusChip link={link} /></TableCell>
                      <TableCell>
                        <Tooltip title={copied === (link.token || link._id) ? 'Copied!' : 'Copy share URL'}>
                          <IconButton
                            size="small"
                            onClick={() => copyUrl(link.token || link._id)}
                            aria-label="Copy share URL"
                          >
                            <ContentCopy
                              fontSize="small"
                              sx={{ color: copied === (link.token || link._id) ? 'var(--status-paid)' : 'inherit' }}
                            />
                          </IconButton>
                        </Tooltip>
                        {!link.revoked && !expired && (
                          <Tooltip title="Revoke link">
                            <IconButton
                              size="small"
                              onClick={() => handleRevoke(link._id)}
                              aria-label="Revoke link"
                            >
                              <Block fontSize="small" sx={{ color: 'var(--brand-red)' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              }
              {!loading && links.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0, py: 0 }}>
                    <Box
                      sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', py: 8, gap: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: 56, height: 56, borderRadius: '50%',
                          bgcolor: '#f3f4f6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <LinkOff sx={{ fontSize: 28, color: 'var(--ink-muted)' }} />
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'var(--ink)' }}>
                        No links yet.
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mb: 0.5 }}>
                        Create a timed share link to give external access to a salary slip or folder.
                      </Typography>
                      <Button
                        variant="outlined" size="small" startIcon={<Add />}
                        onClick={() => { setNewLink(null); setFormErr(''); setOpen(true); }}
                        sx={{ borderColor: 'var(--brand-red)', color: 'var(--brand-red)', '&:hover': { borderColor: 'var(--brand-red-hover)', bgcolor: 'var(--brand-red-tint)' } }}
                      >
                        Create your first link
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create / success dialog */}
      <Dialog open={open} onClose={closeCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {newLink ? 'Link Created' : 'Create Share Link'}
        </DialogTitle>
        <DialogContent>
          {newLink ? (
            /* ── "Shown once" warning — red-tinted banner, impossible to miss ── */
            <Box>
              <Box
                sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1.5,
                  bgcolor: 'var(--brand-red-tint)',
                  border: '1px solid rgba(211,47,47,0.25)',
                  borderRadius: 2, p: 2, mb: 2.5,
                }}
              >
                <WarningAmberRounded sx={{ color: 'var(--brand-red)', flexShrink: 0, mt: 0.25 }} />
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--brand-red)' }}>
                    This link will not be shown again.
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#7f1d1d', mt: 0.25 }}>
                    Copy the URL now and share it securely. Once you close this dialog, the token cannot be retrieved.
                  </Typography>
                </Box>
              </Box>

              <TextField
                label="Share URL"
                value={`${window.location.origin}/share/${newLink.token}`}
                fullWidth size="small" InputProps={{ readOnly: true }}
                sx={{ mb: 1.5, fontFamily: 'monospace' }}
              />
              <Button
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={() => copyUrl(newLink.token)}
                sx={{ mb: 2 }}
              >
                {copied ? 'Copied!' : 'Copy URL'}
              </Button>
              <Typography variant="caption" sx={{ display: 'block', color: 'var(--ink-secondary)' }}>
                Expires: {new Date(newLink.expiresAt).toLocaleString('en-IN')} &nbsp;·&nbsp;
                Max uses: {newLink.maxUses} &nbsp;·&nbsp;
                Permission: {newLink.permission}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ pt: 1 }}>
              {formErr && <Alert severity="error" sx={{ mb: 2 }}>{formErr}</Alert>}

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Resource type</InputLabel>
                <Select value={form.resourceType} label="Resource type" onChange={e => f('resourceType', e.target.value)}>
                  <MenuItem value="salarySlip">Salary Slip</MenuItem>
                  <MenuItem value="folder">Folder</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="B2 object key or folder prefix"
                value={form.resourceKey} onChange={e => f('resourceKey', e.target.value)}
                fullWidth size="small" sx={{ mb: 2 }}
                helperText="e.g. payroll/Employees/EMP001/2026/06/payslip.pdf"
              />

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Permission</InputLabel>
                <Select value={form.permission} label="Permission" onChange={e => f('permission', e.target.value)}>
                  <MenuItem value="view">View only</MenuItem>
                  <MenuItem value="download">Download</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Recipient label (optional)" value={form.recipientLabel}
                onChange={e => f('recipientLabel', e.target.value)}
                fullWidth size="small" sx={{ mb: 2 }}
                helperText="e.g. CA – Sharma & Co  (shown in audit log)"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Expiry</InputLabel>
                  <Select value={form.expiryPreset} label="Expiry" onChange={e => f('expiryPreset', e.target.value)}>
                    {EXPIRY_OPTIONS.map(o => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Max uses" type="number" value={form.maxUses} size="small" sx={{ flex: 1 }}
                  onChange={e => f('maxUses', e.target.value)}
                  inputProps={{ min: 1 }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeCreateDialog}>
            {newLink ? 'Close' : 'Cancel'}
          </Button>
          {!newLink && (
            <Button
              variant="contained" onClick={handleCreate} disabled={saving}
              sx={{ bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
            >
              {saving ? 'Creating…' : 'Create Link'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
