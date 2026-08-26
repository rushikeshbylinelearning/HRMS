// src/pages/ShareRedeemPage.jsx
//
// Public, unauthenticated page for external recipients (CAs, auditors, etc.).
// No login required — the URL token IS the credential.
//
// UX note displayed on-page: "view" permission is a UI convention.
// The PDF is watermarked with the recipient label + date.
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Alert, CircularProgress,
  Chip, Divider,
} from '@mui/material';
import { Download, OpenInNew, LockOutlined, InfoOutlined } from '@mui/icons-material';
import axios from 'axios';

// Use a plain axios instance — no auth interceptors needed for a public endpoint
const publicApi = axios.create({ baseURL: '/api', withCredentials: false });

export default function ShareRedeemPage() {
  const { token } = useParams();

  const [state, setState]   = useState('loading'); // loading | ready | error | expired
  const [data,  setData]    = useState(null);
  const [msg,   setMsg]     = useState('');

  useEffect(() => {
    if (!token || token.length !== 64) {
      setState('error');
      setMsg('This link is invalid. The URL may have been truncated or mis-copied.');
      return;
    }

    // Call the public redemption endpoint
    // The server validates token, expiry, revocation, and use count,
    // then returns a short-lived presigned B2 URL.
    publicApi.get(`/share/${token}`)
      .then(res => {
        setData(res.data);
        setState('ready');
      })
      .catch(err => {
        const status = err.response?.status;
        const serverMsg = err.response?.data?.error;
        if (status === 404 || status === 410) {
          setState('expired');
          setMsg(serverMsg || 'This link has expired, been revoked, or has reached its maximum number of uses.');
        } else if (status === 429) {
          setState('error');
          setMsg('Too many requests. Please wait a moment and try again.');
        } else {
          setState('error');
          setMsg(serverMsg || 'An unexpected error occurred. Please try again later.');
        }
      });
  }, [token]);

  const openDocument = (mode) => {
    if (!data?.presignedUrl) return;
    if (mode === 'download') {
      // Force download via anchor
      const a = document.createElement('a');
      a.href = data.presignedUrl;
      a.download = '';
      a.rel = 'noopener noreferrer';
      a.click();
    } else {
      window.open(data.presignedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f5f7fa',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 520, borderRadius: 2 }}>
        <CardContent sx={{ p: 4 }}>

          {/* Loading */}
          {state === 'loading' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Validating link…
              </Typography>
            </Box>
          )}

          {/* Error / Expired */}
          {(state === 'error' || state === 'expired') && (
            <Box sx={{ textAlign: 'center' }}>
              <LockOutlined sx={{ fontSize: 48, color: 'error.main', mb: 1 }} />
              <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                {state === 'expired' ? 'Link unavailable' : 'Something went wrong'}
              </Typography>
              <Alert severity={state === 'expired' ? 'warning' : 'error'} sx={{ textAlign: 'left' }}>
                {msg}
              </Alert>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                If you believe this is an error, contact the person who shared this link.
              </Typography>
            </Box>
          )}

          {/* Ready */}
          {state === 'ready' && data && (
            <Box>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <LockOutlined sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700} color="primary.main">
                  Shared Document
                </Typography>
              </Box>

              {/* Document info */}
              <Box sx={{ bgcolor: '#f0f4ff', borderRadius: 1.5, p: 2, mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>
                  {data.resourceLabel || 'Salary Slip'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={data.resourceType === 'salarySlip' ? 'Salary Slip' : 'Folder'}
                    size="small" variant="outlined"
                  />
                  <Chip
                    label={data.permission === 'download' ? 'Download' : 'View only'}
                    size="small"
                    color={data.permission === 'download' ? 'primary' : 'default'}
                  />
                </Box>
                {data.recipientLabel && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Shared with: {data.recipientLabel}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Expires: {new Date(data.expiresAt).toLocaleString('en-IN')}
                </Typography>
              </Box>

              {/* View / download note */}
              {data.viewNote && (
                <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2, fontSize: 12 }}>
                  {data.viewNote}
                </Alert>
              )}

              <Alert severity="warning" sx={{ mb: 2.5, fontSize: 12 }}>
                The document URL expires in <strong>10 minutes</strong>. If you need it again,
                re-open the original share link.
              </Alert>

              <Divider sx={{ mb: 2 }} />

              {/* Action buttons */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={data.permission === 'download' ? <Download /> : <OpenInNew />}
                  onClick={() => openDocument(data.permission === 'download' ? 'download' : 'inline')}
                  size="large"
                >
                  {data.permission === 'download' ? 'Download Document' : 'Open Document'}
                </Button>

                {/* Allow download even in view mode — the "view" constraint is a UI hint */}
                {data.permission === 'view' && (
                  <Button
                    variant="outlined" fullWidth startIcon={<Download />}
                    onClick={() => openDocument('download')} size="large"
                  >
                    Download Anyway
                  </Button>
                )}
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
                Powered by Byline LMS Payroll Portal
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
