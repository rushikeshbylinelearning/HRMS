// src/components/PdfViewerModal.jsx
//
// Custom PDF viewer modal — renders via react-pdf (PDF.js canvas).
// No browser PDF extension required; works cross-browser in a controlled UI.
//
// Props:
//   open       {boolean}  — controls visibility
//   onClose    {function} — called when user closes
//   url        {string}   — presigned URL or any PDF URL
//   filename   {string}   — shown in the header

import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, IconButton, Tooltip, Typography, Button,
  CircularProgress, Slider, Stack, Divider,
} from '@mui/material';
import {
  Close, NavigateBefore, NavigateNext,
  ZoomIn, ZoomOut, FitScreen, Download,
  FirstPage, LastPage,
} from '@mui/icons-material';

// ── PDF.js worker ─────────────────────────────────────────────────────────────
// Point at the CDN-hosted worker that matches the pdfjs-dist version bundled
// with react-pdf so we don't have to copy the worker file manually.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;
const DEFAULT_SCALE = 1.0;

export default function PdfViewerModal({ open, onClose, url, filename }) {
  const [numPages,    setNumPages]    = useState(null);
  const [pageNumber,  setPageNumber]  = useState(1);
  const [scale,       setScale]       = useState(DEFAULT_SCALE);
  const [loadError,   setLoadError]   = useState('');
  const [pageInput,   setPageInput]   = useState('1');

  // Reset state each time a new document opens
  const handleOpen = useCallback(() => {
    setNumPages(null);
    setPageNumber(1);
    setScale(DEFAULT_SCALE);
    setLoadError('');
    setPageInput('1');
  }, []);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setPageInput('1');
  };

  const onDocumentLoadError = (err) => {
    console.error('[PdfViewer] load error:', err);
    setLoadError('Failed to load PDF. The link may have expired — please close and try again.');
  };

  const goTo = (n) => {
    const clamped = Math.max(1, Math.min(n, numPages || 1));
    setPageNumber(clamped);
    setPageInput(String(clamped));
  };

  const handlePageInputBlur = () => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n)) goTo(n);
    else setPageInput(String(pageNumber));
  };

  const zoomIn  = () => setScale(s => Math.min(+(s + SCALE_STEP).toFixed(2), MAX_SCALE));
  const zoomOut = () => setScale(s => Math.max(+(s - SCALE_STEP).toFixed(2), MIN_SCALE));
  const fitPage = () => setScale(DEFAULT_SCALE);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    a.click();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      TransitionProps={{ onEnter: handleOpen }}
      PaperProps={{
        sx: {
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#1e1e1e',
          color: '#fff',
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1,
          px: 2,
          bgcolor: '#2d2d2d',
          borderBottom: '1px solid #444',
          minHeight: 52,
        }}
      >
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ flex: 1, color: '#e0e0e0', fontWeight: 500 }}
          title={filename}
        >
          {filename}
        </Typography>

        <Tooltip title="Download">
          <span>
            <IconButton size="small" onClick={handleDownload} disabled={!url} sx={{ color: '#ccc' }}>
              <Download fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} sx={{ color: '#ccc' }}>
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      {/* ── Toolbar ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 2,
          py: 0.75,
          bgcolor: '#2d2d2d',
          borderBottom: '1px solid #444',
          flexWrap: 'wrap',
        }}
      >
        {/* Page navigation */}
        <Tooltip title="First page">
          <span>
            <IconButton size="small" onClick={() => goTo(1)} disabled={pageNumber <= 1} sx={{ color: '#ccc' }}>
              <FirstPage fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Previous page">
          <span>
            <IconButton size="small" onClick={() => goTo(pageNumber - 1)} disabled={pageNumber <= 1} sx={{ color: '#ccc' }}>
              <NavigateBefore fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          <input
            value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            onBlur={handlePageInputBlur}
            onKeyDown={e => e.key === 'Enter' && handlePageInputBlur()}
            style={{
              width: 40,
              textAlign: 'center',
              background: '#3a3a3a',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#fff',
              padding: '2px 4px',
              fontSize: 13,
            }}
          />
          <Typography variant="caption" sx={{ color: '#aaa', whiteSpace: 'nowrap' }}>
            / {numPages ?? '—'}
          </Typography>
        </Stack>

        <Tooltip title="Next page">
          <span>
            <IconButton size="small" onClick={() => goTo(pageNumber + 1)} disabled={!numPages || pageNumber >= numPages} sx={{ color: '#ccc' }}>
              <NavigateNext fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Last page">
          <span>
            <IconButton size="small" onClick={() => goTo(numPages)} disabled={!numPages || pageNumber >= numPages} sx={{ color: '#ccc' }}>
              <LastPage fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#555' }} />

        {/* Zoom controls */}
        <Tooltip title="Zoom out">
          <span>
            <IconButton size="small" onClick={zoomOut} disabled={scale <= MIN_SCALE} sx={{ color: '#ccc' }}>
              <ZoomOut fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ width: 90 }}>
          <Slider
            size="small"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={SCALE_STEP}
            value={scale}
            onChange={(_, v) => setScale(v)}
            sx={{ color: '#90caf9' }}
          />
        </Box>

        <Tooltip title="Zoom in">
          <span>
            <IconButton size="small" onClick={zoomIn} disabled={scale >= MAX_SCALE} sx={{ color: '#ccc' }}>
              <ZoomIn fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Typography variant="caption" sx={{ color: '#aaa', minWidth: 38, textAlign: 'right' }}>
          {Math.round(scale * 100)}%
        </Typography>

        <Tooltip title="Reset zoom">
          <span>
            <IconButton size="small" onClick={fitPage} sx={{ color: '#ccc' }}>
              <FitScreen fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* ── PDF canvas area ── */}
      <DialogContent
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          bgcolor: '#525659',
          p: 3,
        }}
      >
        {loadError ? (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography color="error" sx={{ mb: 2 }}>{loadError}</Typography>
            <Button variant="outlined" color="inherit" onClick={onClose}>Close</Button>
          </Box>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, gap: 2 }}>
                <CircularProgress sx={{ color: '#90caf9' }} />
                <Typography sx={{ color: '#ccc' }} variant="body2">Loading PDF…</Typography>
              </Box>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer
              renderAnnotationLayer
              loading={
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <CircularProgress size={28} sx={{ color: '#90caf9' }} />
                </Box>
              }
              // Drop shadow so the white page stands out from the grey background
              canvasBackground="white"
            />
          </Document>
        )}
      </DialogContent>

      {/* ── Footer ── */}
      <DialogActions sx={{ bgcolor: '#2d2d2d', borderTop: '1px solid #444', py: 0.75, px: 2 }}>
        <Typography variant="caption" sx={{ flex: 1, color: '#888' }}>
          {numPages ? `Page ${pageNumber} of ${numPages}` : 'Loading…'}
        </Typography>
        <Button size="small" onClick={onClose} sx={{ color: '#ccc' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
