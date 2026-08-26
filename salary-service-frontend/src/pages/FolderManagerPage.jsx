// src/pages/FolderManagerPage.jsx
// B2 folder browser — file-type icons via lucide-react pattern (using MUI icons).
// Recursive delete requires typing the folder name (IRREVERSIBLE per spec).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Breadcrumbs, Link, List, ListItemButton, ListItemIcon,
  ListItemText, IconButton, Tooltip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Chip,
  CircularProgress,
} from '@mui/material';
import {
  FolderRounded, PictureAsPdf, CreateNewFolder, UploadFile,
  DeleteOutlined, ArrowUpward, Refresh, VisibilityOutlined,
  FolderOff,
} from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PdfViewerModal from '../components/PdfViewerModal';

const ROOT_PREFIX = 'payroll/';

export default function FolderManagerPage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'Admin';
  const fileRef  = useRef(null);

  const [prefix,    setPrefix]    = useState(ROOT_PREFIX);
  const [items,     setItems]     = useState({ objects: [], folders: [] });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [info,      setInfo]      = useState('');

  // Create folder
  const [cfOpen,   setCfOpen]   = useState(false);
  const [cfName,   setCfName]   = useState('');
  const [cfSaving, setCfSaving] = useState(false);

  // Delete confirmation — requires typing folder name for recursive deletes
  const [delTarget,      setDelTarget]      = useState(null);
  const [delConfirmText, setDelConfirmText] = useState('');
  const [delBusy,        setDelBusy]        = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);

  // View
  const [viewingKey, setViewingKey] = useState('');
  const [pdfModal,   setPdfModal]   = useState({ open: false, url: '', name: '' });

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.get('/folders', { params: { prefix, delimiter: '/' } })
      .then(r => setItems({ objects: r.data.objects || [], folders: r.data.folders || [] }))
      .catch(() => setError('Failed to list folder contents.'))
      .finally(() => setLoading(false));
  }, [prefix]);

  useEffect(() => { load(); }, [load]);

  const crumbs = prefix.replace(/\/$/, '').split('/').filter(Boolean);

  const navigateTo = (idx) => {
    const p = crumbs.slice(0, idx + 1).join('/') + '/';
    setPrefix(p);
  };

  const createFolder = async () => {
    if (!cfName.trim()) return;
    setCfSaving(true); setError('');
    try {
      await api.post('/folders', { folderName: cfName.trim() });
      setInfo(`Folder "${cfName.trim()}" created.`);
      setTimeout(() => setInfo(''), 3500);
      setCfOpen(false); setCfName('');
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create folder.');
    } finally {
      setCfSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!delTarget) return;
    // For folders require the user to type the name
    if (delTarget.isFolder) {
      const expectedName = filename(delTarget.key);
      if (delConfirmText !== expectedName) return;
    }
    setDelBusy(true); setError('');
    try {
      if (delTarget.isFolder) {
        await api.delete('/folders', { data: { prefix: delTarget.key } });
        setInfo('Folder deleted.');
      } else {
        await api.delete('/folders/file', { data: { key: delTarget.key } });
        setInfo('File deleted.');
      }
      setTimeout(() => setInfo(''), 3500);
      setDelTarget(null); setDelConfirmText('');
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete.');
      setDelTarget(null); setDelConfirmText('');
    } finally {
      setDelBusy(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true); setError('');
    const folderName = crumbs[crumbs.length - 1] || 'Shared';
    const fd = new FormData();
    fd.append('folderName', folderName);
    fd.append('file', file);
    try {
      await api.post('/folders/upload', fd);
      setInfo(`"${file.name}" uploaded.`);
      setTimeout(() => setInfo(''), 3500);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed. Only PDFs up to 10 MB are accepted.');
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (key) => {
    setViewingKey(key);
    try {
      const { data } = await api.get('/folders/view', { params: { key } });
      setPdfModal({ open: true, url: data.url, name: filename(key) });
    } catch {
      setError('Could not generate a view URL.');
    } finally {
      setViewingKey('');
    }
  };

  const filename = (key) => key.split('/').filter(Boolean).pop() || key;

  const fileObjects = items.objects.filter(o => !o.key.endsWith('/'));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>Folder Manager</Typography>
          <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.25 }}>
            B2 document storage — PDFs only, max 10 MB per file.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh">
            <IconButton onClick={load} size="small" aria-label="Refresh">
              <Refresh />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <Button variant="outlined" size="small" startIcon={<CreateNewFolder />}
              onClick={() => setCfOpen(true)}>
              New Folder
            </Button>
          )}
          <Button
            variant="contained" size="small"
            startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <UploadFile />}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            sx={{ bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
          >
            Upload PDF
          </Button>
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={handleUpload} />
        </Box>
      </Box>

      {error && <Alert severity="error"   sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
      {info  && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setInfo('')}>{info}</Alert>}

      {/* Breadcrumb */}
      <Breadcrumbs sx={{ mb: 1.5, fontSize: '0.875rem' }}>
        <Link
          component="button" underline="hover" variant="body2"
          onClick={() => setPrefix(ROOT_PREFIX)}
          sx={{ color: 'var(--ink-secondary)' }}
        >
          payroll
        </Link>
        {crumbs.slice(1).map((part, idx) => (
          <Link
            key={idx} component="button" underline="hover" variant="body2"
            onClick={() => navigateTo(idx + 1)}
            sx={{ color: idx === crumbs.length - 2 ? 'var(--ink)' : 'var(--ink-secondary)' }}
          >
            {part}
          </Link>
        ))}
      </Breadcrumbs>

      {/* File list */}
      <Box
        sx={{
          bgcolor: 'var(--paper)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)', overflow: 'hidden',
          minHeight: 120,
        }}
      >
        {/* Column header — navy row matching other pages' table headers */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'var(--sidebar-navy)',
            px: 2,
            py: 1,
            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.8125rem',
              flex: 1,
            }}
          >
            Name
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.8125rem', minWidth: 120, textAlign: 'right' }}
          >
            Size · Modified
          </Typography>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <List dense disablePadding>
            {/* Up a level */}
            {prefix !== ROOT_PREFIX && (
              <ListItemButton
                onClick={() => {
                  const parts = prefix.replace(/\/$/, '').split('/');
                  parts.pop();
                  setPrefix(parts.join('/') + '/');
                }}
                sx={{ borderBottom: '1px solid var(--border)', py: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ArrowUpward sx={{ fontSize: 18, color: 'var(--ink-secondary)' }} />
                </ListItemIcon>
                <ListItemText
                  primary=".."
                  primaryTypographyProps={{ variant: 'body2', color: 'var(--ink-secondary)' }}
                />
              </ListItemButton>
            )}

            {/* Folders */}
            {items.folders.map(f => (
              <ListItemButton
                key={f}
                onClick={() => setPrefix(f)}
                sx={{ borderBottom: '1px solid var(--border)', py: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <FolderRounded sx={{ color: '#f59e0b', fontSize: 22 }} />
                </ListItemIcon>
                <ListItemText
                  primary={filename(f) + '/'}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'var(--ink)' }}
                />
                {isAdmin && (
                  <Tooltip title="Delete folder — irreversible">
                    <IconButton
                      size="small" edge="end"
                      onClick={e => { e.stopPropagation(); setDelConfirmText(''); setDelTarget({ key: f, isFolder: true }); }}
                      aria-label="Delete folder"
                      sx={{ color: 'var(--ink-muted)', '&:hover': { color: 'var(--brand-red)' } }}
                    >
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </ListItemButton>
            ))}

            {/* Files */}
            {fileObjects.map(obj => (
              <ListItemButton
                key={obj.key}
                disableRipple
                sx={{
                  borderBottom: '1px solid var(--border)', py: 1,
                  '&:hover': { bgcolor: '#f8fafc' },
                  cursor: 'default',
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <PictureAsPdf sx={{ color: 'var(--brand-red)', fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText
                  primary={filename(obj.key)}
                  secondary={`${(obj.size / 1024).toFixed(1)} KB  ·  ${new Date(obj.lastModified).toLocaleDateString('en-IN')}`}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: 'var(--ink)' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    label="PDF" size="small" variant="outlined"
                    sx={{ fontSize: '0.6875rem', height: 20, borderRadius: 1, mr: 1 }}
                  />
                  <Tooltip title="View PDF">
                    <span>
                      <IconButton
                        size="small"
                        disabled={viewingKey === obj.key}
                        onClick={() => handleView(obj.key)}
                        aria-label="View PDF"
                        sx={{ color: 'var(--ink-secondary)' }}
                      >
                        {viewingKey === obj.key
                          ? <CircularProgress size={14} />
                          : <VisibilityOutlined fontSize="small" />
                        }
                      </IconButton>
                    </span>
                  </Tooltip>
                  {isAdmin && (
                    <Tooltip title="Delete file">
                      <IconButton
                        size="small"
                        onClick={() => { setDelConfirmText(''); setDelTarget({ key: obj.key, isFolder: false }); }}
                        aria-label="Delete file"
                        sx={{ color: 'var(--ink-muted)', '&:hover': { color: 'var(--brand-red)' } }}
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </ListItemButton>
            ))}

            {items.folders.length === 0 && fileObjects.length === 0 && (
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
                  <FolderOff sx={{ fontSize: 28, color: 'var(--ink-muted)' }} />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'var(--ink)' }}>
                  This folder is empty.
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mb: 0.5 }}>
                  Upload a PDF or create a sub-folder to get started.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button
                    variant="outlined" size="small"
                    startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <UploadFile />}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    sx={{ borderColor: 'var(--brand-red)', color: 'var(--brand-red)', '&:hover': { borderColor: 'var(--brand-red-hover)', bgcolor: 'var(--brand-red-tint)' } }}
                  >
                    Upload PDF
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outlined" size="small" startIcon={<CreateNewFolder />}
                      onClick={() => setCfOpen(true)}
                      sx={{ borderColor: 'var(--ink-secondary)', color: 'var(--ink-secondary)' }}
                    >
                      New Folder
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </List>
        )}
      </Box>

      {/* Create folder dialog */}
      <Dialog open={cfOpen} onClose={() => setCfOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>New Shared Folder</DialogTitle>
        <DialogContent>
          <TextField
            label="Folder name" value={cfName} autoFocus fullWidth size="small" sx={{ mt: 1 }}
            onChange={e => setCfName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createFolder()}
            helperText="Letters, numbers, spaces, hyphens and underscores only."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCfOpen(false)}>Cancel</Button>
          <Button
            variant="contained" onClick={createFolder}
            disabled={cfSaving || !cfName.trim()}
            sx={{ bgcolor: 'var(--brand-red)', '&:hover': { bgcolor: 'var(--brand-red-hover)' } }}
          >
            {cfSaving ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation — folders require typing the name (IRREVERSIBLE) */}
      <Dialog open={Boolean(delTarget)} onClose={() => setDelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'var(--brand-red)' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Alert
            severity="error"
            sx={{ mb: 2, borderRadius: 2 }}
            icon={false}
          >
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
              {delTarget?.isFolder
                ? 'This will permanently delete the folder and ALL its contents.'
                : 'This will permanently delete the file.'}
            </Typography>
            <Typography variant="body2">
              This action <strong>cannot be undone</strong>.
            </Typography>
          </Alert>

          <Typography
            variant="body2"
            sx={{ color: 'var(--ink-secondary)', mb: 1.5, wordBreak: 'break-all', fontSize: '0.8125rem' }}
          >
            <strong>Path:</strong> {delTarget?.key}
          </Typography>

          {/* Folder deletes require typing the name */}
          {delTarget?.isFolder && (
            <TextField
              label={`Type "${filename(delTarget.key)}" to confirm`}
              value={delConfirmText}
              onChange={e => setDelConfirmText(e.target.value)}
              fullWidth size="small" autoFocus
              helperText="Folder name must match exactly"
              error={delConfirmText.length > 0 && delConfirmText !== filename(delTarget.key)}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setDelTarget(null); setDelConfirmText(''); }}>
            Cancel
          </Button>
          <Button
            variant="contained" color="error" onClick={deleteItem} disabled={
              delBusy ||
              (delTarget?.isFolder && delConfirmText !== filename(delTarget.key))
            }
            sx={{ fontWeight: 700 }}
          >
            {delBusy ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PDF viewer */}
      <PdfViewerModal
        open={pdfModal.open}
        onClose={() => setPdfModal({ open: false, url: '', name: '' })}
        url={pdfModal.url}
        filename={pdfModal.name}
      />
    </Box>
  );
}
