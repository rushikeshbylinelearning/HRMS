// src/pages/DashboardPage.jsx
// Stat cards stagger-in via CSS animation (60ms stagger, 200ms ease-out, 8px translateY).
// .currency applied to all rupee figures.
import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip,
  Skeleton, Alert,
} from '@mui/material';
import {
  ReceiptLong, CheckCircle, PendingActions, Payments,
} from '@mui/icons-material';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

// ─── Stat card — CSS stagger-in ───────────────────────────────────────────────
// Each card animates from opacity 0 + translateY(8px) using a CSS keyframe.
// Stagger is achieved by setting animation-delay per index (0, 60ms, 120ms, 180ms).
function StatCard({ label, value, icon, accent, loading, index }) {
  return (
    <Card
      data-stat-card
      sx={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        animation: `statCardIn 200ms ease-out both`,
        animationDelay: `${index * 60}ms`,
        overflow: 'visible',
      }}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: '20px !important', minHeight: 88 }}>
        <Box
          sx={{
            width: 48, height: 48,
            borderRadius: 2,
            bgcolor: accent + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {React.cloneElement(icon, { sx: { color: accent, fontSize: 22 } })}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ color: 'var(--ink-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem' }}
          >
            {label}
          </Typography>
          {loading
            ? <Skeleton width={64} height={36} sx={{ mt: 0.25 }} />
            : (
              <Typography
                variant="h5"
                className="currency"
                sx={{ fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, mt: 0.25 }}
              >
                {value ?? '—'}
              </Typography>
            )
          }
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Rupee formatting helper ──────────────────────────────────────────────────
function fmtINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

// ─── DashboardPage ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [runs,    setRuns]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/payroll-runs')
      .then(res => setRuns(res.data.runs || []))
      .catch(() => setError('Failed to load payroll data.'))
      .finally(() => setLoading(false));
  }, []);

  const draft     = runs.filter(r => r.status === 'draft').length;
  const finalized = runs.filter(r => r.status === 'finalized').length;
  const paid      = runs.filter(r => r.status === 'paid').length;
  const totalNet  = runs.reduce((s, r) => s + (r.totalNet || 0), 0);

  const STATS = [
    { label: 'Total Runs',  value: runs.length, icon: <ReceiptLong />,    accent: '#1e40af'  },
    { label: 'Draft',       value: draft,        icon: <PendingActions />, accent: '#6b7280'  },  // --status-draft
    { label: 'Finalized',   value: finalized,    icon: <CheckCircle />,    accent: '#b45309'  },  // --status-finalized
    { label: 'Paid',        value: paid,         icon: <Payments />,       accent: '#15803d'  },  // --status-paid
  ];

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)', mb: 0.5 }}>
          Welcome back, {user?.fullName?.split(' ')[0] || user?.email}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)' }}>
          Payroll portal — manage salary runs, slips, and document sharing.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Stat cards — CSS stagger-in */}
      <Box sx={{ mb: 4, width: '100%' }}>
        <Grid container spacing={2.5}>
          {STATS.map((s, i) => (
            <Grid item xs={12} sm={6} md={3} key={s.label}>
              <StatCard {...s} loading={loading} index={i} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Net pay summary — ledger seal required by spec Section 3 */}
      {!loading && runs.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Card sx={{
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
            background: 'linear-gradient(135deg, #10193f 0%, #192a56 100%)',
          }}>
            <CardContent sx={{ p: '20px !important' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem' }}>
                Total Net Pay Disbursed (all runs)
              </Typography>
              {/* Ledger seal — spec Section 3: 28px circle in --ledger-seal, inline before the ₹ figure */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
                <span className="ledger-seal" aria-hidden="true" />
                <Typography
                  className="currency"
                  sx={{ fontWeight: 700, fontSize: '2rem', color: '#fff', lineHeight: 1 }}
                >
                  {fmtINR(totalNet)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Recent runs */}
      <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--ink)', mb: 2 }}>
        Recent Payroll Runs
      </Typography>

      {loading
        ? [1, 2, 3, 4].map(i => (
          <Skeleton key={i} height={60} sx={{ mb: 1, borderRadius: 2 }} />
        ))
        : runs.length === 0
          ? (
            <Box sx={{
              textAlign: 'center', py: 6,
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-card)',
            }}>
              <ReceiptLong sx={{ fontSize: 40, color: 'var(--ink-muted)', mb: 1 }} />
              <Typography color="text.secondary">
                No payroll runs yet. Create the first one from Payroll Runs.
              </Typography>
            </Box>
          )
          : runs.slice(0, 8).map(run => {
            const periodLabel = new Date(run.year, run.month - 1)
              .toLocaleString('en-IN', { month: 'short', year: 'numeric' });

            const statusSx = {
              draft:     { bgcolor: '#f3f4f6', color: 'var(--status-draft)' },
              finalized: { bgcolor: '#fffbeb', color: 'var(--status-finalized)' },
              paid:      { bgcolor: 'var(--status-paid-tint)', color: 'var(--status-paid)' },
            }[run.status] || {};

            return (
              <Card
                key={run._id}
                sx={{
                  mb: 1.25, borderRadius: 2,
                  border: '1px solid var(--border)',
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'var(--shadow-card)', transform: 'translateY(-1px)' },
                  transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                }}
              >
                <CardContent sx={{
                  py: '12px !important', px: '20px !important',
                  display: 'flex', alignItems: 'center', gap: 2,
                  flexWrap: 'nowrap', minHeight: 56,
                }}>
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 88, color: 'var(--ink)' }}>
                    {periodLabel}
                  </Typography>

                  <Chip
                    label={run.status}
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.6875rem', borderRadius: 'var(--radius-pill)', ...statusSx }}
                  />

                  <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', fontSize: '0.8125rem' }}>
                    {run.employeeCount ?? 0} employees
                  </Typography>

                  <Box sx={{ ml: 'auto', display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'var(--ink-muted)', display: 'block', lineHeight: 1, mb: 0.25 }}>
                        Gross
                      </Typography>
                      <Typography variant="body2" className="currency" sx={{ color: 'var(--ink-secondary)' }}>
                        {fmtINR(run.totalGross)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'var(--ink-muted)', display: 'block', lineHeight: 1, mb: 0.25 }}>
                        Net Pay
                      </Typography>
                      <Typography variant="body2" className="currency" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
                        {fmtINR(run.totalNet)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })
      }
    </Box>
  );
}
