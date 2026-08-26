// src/pages/LoginPage.jsx
// Split-panel login — mirrors AMS LoginPage.css structure.
// Left: form. Right: abstract ledger illustration (SVG inline — no external asset needed).
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

// ─── Abstract payroll/ledger illustration (inline SVG) ──────────────────────
// Simple geometric shapes suggesting document rows and columns. No stock imagery.
function LedgerIllustration() {
  return (
    <svg
      viewBox="0 0 480 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: 460, height: 'auto' }}
      aria-hidden="true"
    >
      {/* Background card */}
      <rect x="20" y="20" width="440" height="340" rx="20" fill="white"
        stroke="#e5e7eb" strokeWidth="1.5"
        style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.08))' }}
      />

      {/* Header bar */}
      <rect x="20" y="20" width="440" height="52" rx="20" fill="#10193f" />
      <rect x="20" y="52" width="440" height="20" fill="#10193f" />
      <circle cx="56" cy="46" r="10" fill="rgba(255,255,255,0.15)" />
      <rect x="76" y="38" width="120" height="10" rx="5" fill="rgba(255,255,255,0.5)" />
      <rect x="344" y="38" width="80" height="10" rx="5" fill="rgba(255,255,255,0.2)" />

      {/* Column headers */}
      <rect x="44" y="88" width="90" height="8" rx="4" fill="#e5e7eb" />
      <rect x="170" y="88" width="60" height="8" rx="4" fill="#e5e7eb" />
      <rect x="268" y="88" width="60" height="8" rx="4" fill="#e5e7eb" />
      <rect x="366" y="88" width="68" height="8" rx="4" fill="#e5e7eb" />

      {/* Divider */}
      <line x1="44" y1="106" x2="436" y2="106" stroke="#e5e7eb" strokeWidth="1" />

      {/* Row 1 */}
      <circle cx="56" cy="126" r="12" fill="#f0f4ff" />
      <text x="56" y="131" textAnchor="middle" fontSize="10" fill="#10193f" fontWeight="700">A</text>
      <rect x="76" y="120" width="80" height="7" rx="3.5" fill="#1a202c" opacity="0.8" />
      <rect x="76" y="132" width="54" height="6" rx="3" fill="#e5e7eb" />
      <rect x="170" y="122" width="56" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="268" y="122" width="56" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="366" y="119" width="68" height="14" rx="7" fill="#dcfce7" />
      <text x="400" y="130" textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="700">PAID</text>
      {/* Ledger seal dot on row 1 */}
      <circle cx="385" cy="126" r="6" fill="#a01f1f" />
      <circle cx="385" cy="126" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />

      {/* Row 2 */}
      <circle cx="56" cy="160" r="12" fill="#fef9c3" />
      <text x="56" y="165" textAnchor="middle" fontSize="10" fill="#b45309" fontWeight="700">B</text>
      <rect x="76" y="154" width="72" height="7" rx="3.5" fill="#1a202c" opacity="0.8" />
      <rect x="76" y="166" width="48" height="6" rx="3" fill="#e5e7eb" />
      <rect x="170" y="156" width="56" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="268" y="156" width="56" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="366" y="153" width="68" height="14" rx="7" fill="#fffbeb" />
      <text x="400" y="164" textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="700">FINAL</text>

      {/* Row 3 */}
      <circle cx="56" cy="194" r="12" fill="#fdecea" />
      <text x="56" y="199" textAnchor="middle" fontSize="10" fill="#d32f2f" fontWeight="700">C</text>
      <rect x="76" y="188" width="88" height="7" rx="3.5" fill="#1a202c" opacity="0.8" />
      <rect x="76" y="200" width="60" height="6" rx="3" fill="#e5e7eb" />
      <rect x="170" y="190" width="56" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="268" y="190" width="56" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="366" y="187" width="68" height="14" rx="7" fill="#f3f4f6" />
      <text x="400" y="198" textAnchor="middle" fontSize="9" fill="#6b7280" fontWeight="700">DRAFT</text>

      {/* Row 4 */}
      <circle cx="56" cy="228" r="12" fill="#f0f4ff" />
      <text x="56" y="233" textAnchor="middle" fontSize="10" fill="#1e40af" fontWeight="700">D</text>
      <rect x="76" y="222" width="68" height="7" rx="3.5" fill="#1a202c" opacity="0.8" />
      <rect x="76" y="234" width="52" height="6" rx="3" fill="#e5e7eb" />
      <rect x="170" y="224" width="56" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="268" y="224" width="56" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="366" y="221" width="68" height="14" rx="7" fill="#dcfce7" />
      <text x="400" y="232" textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="700">PAID</text>
      <circle cx="385" cy="228" r="6" fill="#a01f1f" />
      <circle cx="385" cy="228" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />

      {/* Totals row */}
      <line x1="44" y1="252" x2="436" y2="252" stroke="#e5e7eb" strokeWidth="1.5" />
      <rect x="44" y="262" width="60" height="9" rx="4.5" fill="#1a202c" opacity="0.7" />
      <rect x="268" y="262" width="76" height="9" rx="4.5" fill="#10193f" opacity="0.5" />
      <rect x="366" y="260" width="68" height="14" rx="7" fill="#10193f" />
      <text x="400" y="271" textAnchor="middle" fontSize="9" fill="white" fontWeight="700">₹ NET</text>

      {/* Decorative dots bottom-right */}
      <circle cx="400" cy="310" r="4" fill="#d32f2f" opacity="0.6" />
      <circle cx="416" cy="310" r="4" fill="#d32f2f" opacity="0.3" />
      <circle cx="432" cy="310" r="4" fill="#d32f2f" opacity="0.15" />
    </svg>
  );
}

// ─── LoginPage ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many login attempts. Please wait 15 minutes.');
      } else if (err.response?.status === 403) {
        setError('Account temporarily locked. Try again later.');
      } else {
        setError(err.response?.data?.error || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100vw',
        minHeight: '100vh',
        fontFamily: 'var(--font-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      {/* ── Left: form panel ── */}
      <Box
        sx={{
          flex: '0 0 auto',
          width: { xs: '100%', md: 480 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, md: 5 },
          bgcolor: '#ffffff',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Logo mark */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 5 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: 1.5,
                bgcolor: 'var(--brand-red)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
                ₹
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)' }}>
              Payroll Portal
            </Typography>
          </Box>

          {/* Titles */}
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: 'var(--ink)', mb: 1 }}
          >
            Sign in
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'var(--ink-secondary)', mb: 4 }}
          >
            Use your payroll account credentials — separate from the attendance portal.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              fullWidth
              required
              autoComplete="email"
              autoFocus
              disabled={loading}
              size="small"
              sx={{ mb: 2 }}
              inputProps={{ 'aria-label': 'Email address' }}
            />

            <TextField
              label="Password"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth
              required
              autoComplete="current-password"
              disabled={loading}
              size="small"
              sx={{ mb: 3 }}
              inputProps={{ 'aria-label': 'Password' }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPwd(v => !v)}
                      edge="end"
                      size="small"
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                py: 1.375,
                fontSize: '0.9375rem',
                fontWeight: 700,
                bgcolor: 'var(--brand-red)',
                '&:hover': { bgcolor: 'var(--brand-red-hover)' },
                borderRadius: 'var(--radius-control)',
              }}
            >
              {loading
                ? <CircularProgress size={20} color="inherit" />
                : 'Sign in'
              }
            </Button>
          </Box>

          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'center', mt: 3.5, color: 'var(--ink-muted)' }}
          >
            Need access? Contact your payroll administrator.
          </Typography>
        </Box>
      </Box>

      {/* ── Right: illustration panel (hidden on mobile) ── */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f4f7fb',
          p: 5,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background pattern */}
        <Box
          sx={{
            position: 'absolute', inset: 0,
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(211,47,47,0.04) 0%, transparent 50%),
                              radial-gradient(circle at 75% 75%, rgba(16,25,63,0.05) 0%, transparent 50%)`,
          }}
          aria-hidden="true"
        />
        <Box sx={{ position: 'relative', width: '100%', maxWidth: 500 }}>
          <LedgerIllustration />
          <Typography
            variant="body2"
            sx={{ textAlign: 'center', mt: 3, color: 'var(--ink-secondary)', fontWeight: 500 }}
          >
            Payroll disbursal, salary slips & compliance — in one place.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
