// src/components/TaxesDeductionsTab.jsx
// Phase 3 — Taxes & Deductions Tab
// Aggregate summary cards (PF, ESI, PT, TDS) + per-employee breakdown table.
// Skipped slips are excluded from all aggregates and the table.
// Read-only — no action buttons, no overflow menus.
import React from 'react';
import {
  Box, Typography, Stack,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper,
} from '@mui/material';

function fmtINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

// Reusable aggregate card — matches the "Gross Pay" Box style in PayrollRunDetailPage
function AggregateCard({ label, value }) {
  return (
    <Box
      sx={{
        bgcolor: 'var(--paper)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)', p: '16px 20px',
        boxShadow: 'var(--shadow-card)', minWidth: 160,
      }}
    >
      <Typography variant="caption" sx={{ color: 'var(--ink-secondary)', fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography
        className="currency"
        sx={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', mt: 0.25 }}
      >
        {fmtINR(value)}
      </Typography>
    </Box>
  );
}

export default function TaxesDeductionsTab({ slips }) {
  // Exclude skipped slips from all aggregates and the table
  const activeSlips = (slips || []).filter(slip => slip.skipped !== true);

  const totalPF  = activeSlips.reduce((sum, s) => sum + (s.deductions?.pf || 0), 0);
  const totalESI = activeSlips.reduce((sum, s) => sum + (s.deductions?.esi || 0), 0);
  const totalPT  = activeSlips.reduce((sum, s) => sum + (s.deductions?.professionalTax || 0), 0);
  const totalTDS = activeSlips.reduce((sum, s) => sum + (s.deductions?.tds || 0), 0);

  return (
    <Box>
      {/* Aggregate summary cards */}
      <Stack direction="row" flexWrap="wrap" spacing={2} sx={{ mb: 3 }}>
        <AggregateCard label="Total PF"  value={totalPF}  />
        <AggregateCard label="Total ESI" value={totalESI} />
        <AggregateCard label="Total PT"  value={totalPT}  />
        <AggregateCard label="Total TDS" value={totalTDS} />
      </Stack>

      {/* Per-employee breakdown table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 'var(--radius-card)' }}>
        <Table size="small" aria-label="Taxes and deductions breakdown">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>PF</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>ESI</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>PT</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>TDS</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>LOP Deduction</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Net Pay</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activeSlips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'var(--ink-secondary)', py: 4 }}>
                  No salary slips available.
                </TableCell>
              </TableRow>
            ) : (
              activeSlips.map(slip => (
                <TableRow key={slip._id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {slip.employeeName || slip.employeeId}
                    </Typography>
                    {slip.employeeName && (
                      <Typography variant="caption" sx={{ color: 'var(--ink-secondary)' }}>
                        {slip.employeeId}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <span className="currency">{fmtINR(slip.deductions?.pf)}</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="currency">{fmtINR(slip.deductions?.esi)}</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="currency">{fmtINR(slip.deductions?.professionalTax)}</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="currency">{fmtINR(slip.deductions?.tds)}</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="currency">{fmtINR(slip.deductions?.lopDeduction)}</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="currency">{fmtINR(slip.netPay)}</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
