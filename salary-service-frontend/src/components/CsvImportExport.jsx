// src/components/CsvImportExport.jsx
// Phase 4 — Bulk CSV Import/Export
// Props: { run, onReload }
//   run      — the PayrollRun object (used for _id and status checks)
//   onReload — callback to refresh the parent page after a successful import
import React, { useRef, useState } from 'react';
import {
  Button, Menu, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Typography,
  Table, TableHead, TableBody, TableRow, TableCell,
  CircularProgress, Alert,
} from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import api from '../api/axios';

export default function CsvImportExport({ run, onReload }) {
  const [anchorEl,    setAnchorEl]    = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importError, setImportError] = useState(null); // null | { error, errors: [] }
  const [importType,  setImportType]  = useState(null); // 'lop' | 'one-time'

  const fileInputRef = useRef(null);
  const isDraft = run?.status === 'draft';

  const handleMenuOpen  = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = ()  => setAnchorEl(null);

  // Trigger the hidden file picker for the chosen import type
  const handleImportClick = (type) => {
    setImportType(type);
    handleMenuClose();
    fileInputRef.current.value = ''; // reset so re-selecting the same file fires onChange
    fileInputRef.current.click();
  };

  // Export — triggers a browser download via a new tab
  const handleExport = () => {
    handleMenuClose();
    window.open(`/api/payroll-runs/${run._id}/export/employee-summary`, '_blank');
  };

  // Upload the selected file to the appropriate import endpoint
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = importType === 'lop'
        ? `/payroll-runs/${run._id}/import/lop`
        : `/payroll-runs/${run._id}/import/one-time`;

      await api.post(endpoint, formData);
      onReload();
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors?.length > 0) {
        // API returned per-row validation errors — show the error table
        setImportError(data); // { error, errors: [{ row, employeeId, error }] }
      } else {
        setImportError({ error: data?.error || 'Import failed', errors: [] });
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <Button
        variant="outlined"
        startIcon={
          importing
            ? <CircularProgress size={16} color="inherit" />
            : <UploadFile />
        }
        onClick={handleMenuOpen}
        disabled={importing}
        size="large"
        sx={{ fontWeight: 700, minWidth: 160 }}
        aria-label="Import or export payroll CSV"
        aria-haspopup="true"
        aria-expanded={Boolean(anchorEl)}
      >
        Import / Export
      </Button>

      {/* ── Dropdown menu ── */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          disabled={!isDraft}
          onClick={() => handleImportClick('lop')}
        >
          Import LOP Details
          {!isDraft && (
            <Typography variant="caption" sx={{ ml: 1, color: 'text.disabled' }}>
              (draft only)
            </Typography>
          )}
        </MenuItem>

        <MenuItem
          disabled={!isDraft}
          onClick={() => handleImportClick('one-time')}
        >
          Import Earnings/Deductions
          {!isDraft && (
            <Typography variant="caption" sx={{ ml: 1, color: 'text.disabled' }}>
              (draft only)
            </Typography>
          )}
        </MenuItem>

        <MenuItem onClick={handleExport}>
          Export Employee Summary
        </MenuItem>
      </Menu>

      {/* ── Hidden file input — accepts CSV only ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        hidden
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* ── Import error dialog — shows per-row validation errors if API returns them ── */}
      <Dialog
        open={Boolean(importError)}
        onClose={() => setImportError(null)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="csv-import-error-title"
      >
        <DialogTitle id="csv-import-error-title" sx={{ fontWeight: 700 }}>
          Import Failed
        </DialogTitle>

        <DialogContent>
          <Alert severity="error" sx={{ mb: importError?.errors?.length > 0 ? 2 : 0 }}>
            {importError?.error || 'Import validation failed'}
          </Alert>

          {importError?.errors?.length > 0 && (
            <Table size="small" aria-label="Import error details">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Row</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Employee ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importError.errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.row}</TableCell>
                    <TableCell>{e.employeeId}</TableCell>
                    <TableCell>{e.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setImportError(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
