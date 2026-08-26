// src/pages/PayrollSettingsPage.jsx — Admin only
// Edit global payroll computation settings (percentages, rates).
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Alert, Grid, Paper, Divider,
  CircularProgress, InputAdornment,
} from '@mui/material';
import { SaveOutlined, PercentOutlined, CurrencyRupeeOutlined, CalendarTodayOutlined } from '@mui/icons-material';
import api from '../api/axios';

// Field definitions — grouped by section for visual separation
const SECTIONS = [
  {
    title: 'Salary Component Percentages',
    subtitle: 'Percentage of CTC or component base — enter as a number (e.g. 40 for 40%)',
    fields: [
      { key: 'basicPercentage',      label: 'Basic',       hint: '% of CTC',   type: 'percent' },
      { key: 'hraPercentage',        label: 'HRA',         hint: '% of CTC',   type: 'percent' },
      { key: 'allowancesPercentage', label: 'Allowances',  hint: '% of CTC',   type: 'percent' },
      { key: 'pfPercentage',         label: 'PF',          hint: '% of Basic', type: 'percent' },
      { key: 'esiPercentage',        label: 'ESI',         hint: '% of Gross', type: 'percent' },
      { key: 'tdsPercentage',        label: 'TDS',         hint: '% of Gross', type: 'percent' },
    ],
  },
  {
    title: 'Flat Deductions & Rates',
    subtitle: 'Fixed rupee amounts applied per payroll period',
    fields: [
      { key: 'professionalTax',    label: 'Professional Tax',  hint: '₹ per month',   type: 'amount' },
      { key: 'overtimeHourlyRate', label: 'Overtime Rate',     hint: '₹ per hour',    type: 'amount' },
      { key: 'lopDailyRate',       label: 'LOP Daily Rate',    hint: '₹ / day (0 = auto-compute)', type: 'amount' },
    ],
  },
  {
    title: 'Attendance Parameters',
    subtitle: 'Working days used to normalise per-day salary calculations',
    fields: [
      { key: 'standardWorkingDays', label: 'Standard Working Days', hint: 'Days per month', type: 'days' },
    ],
  },
];

// All flat fields list for save
const ALL_FIELDS = SECTIONS.flatMap(s => s.fields);

function fieldAdornment(type) {
  if (type === 'percent') return <PercentOutlined sx={{ fontSize: 16, color: 'var(--ink-muted)' }} />;
  if (type === 'amount')  return <CurrencyRupeeOutlined sx={{ fontSize: 16, color: 'var(--ink-muted)' }} />;
  if (type === 'days')    return <CalendarTodayOutlined sx={{ fontSize: 16, color: 'var(--ink-muted)' }} />;
  return null;
}

export default function PayrollSettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  useEffect(() => {
    api.get('/payroll-settings')
      .then(r => setSettings(r.data.settings || {}))
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, val) => {
    setSuccess('');
    setSettings(s => ({ ...s, [key]: val }));
  };

  const handleSave = async () => {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const body = {};
      ALL_FIELDS.forEach(f => {
        if (settings[f.key] !== undefined && settings[f.key] !== '') {
          body[f.key] = Number(settings[f.key]);
        }
      });
      await api.put('/payroll-settings', body);
      setSuccess('Settings saved. Changes will apply to the next payroll run.');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: 'var(--brand-red)' }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
          Payroll Settings
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--ink-secondary)', mt: 0.5 }}>
          Global computation parameters — changes take effect on the next payroll run
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 'var(--radius-control)' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2.5, borderRadius: 'var(--radius-control)' }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Settings sections */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {SECTIONS.map(section => (
          <Paper
            key={section.title}
            sx={{
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
            }}
          >
            {/* Section header */}
            <Box sx={{ px: 3, py: 2, backgroundColor: '#fafbfc', borderBottom: '1px solid var(--border)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--ink)' }}>
                {section.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--ink-secondary)' }}>
                {section.subtitle}
              </Typography>
            </Box>

            {/* Fields grid */}
            <Box sx={{ p: 3 }}>
              <Grid container spacing={2.5}>
                {section.fields.map(field => (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={section.fields.length === 6 ? 2 : 4}
                    key={field.key}
                  >
                    <TextField
                      label={field.label}
                      type="number"
                      size="small"
                      fullWidth
                      value={settings[field.key] ?? ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      inputProps={{
                        step: field.type === 'percent' ? 0.5 : 1,
                        min: 0,
                        ...(field.type === 'percent' && { max: 100 }),
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            {fieldAdornment(field.type)}
                          </InputAdornment>
                        ),
                      }}
                      helperText={field.hint}
                      FormHelperTextProps={{ sx: { color: 'var(--ink-muted)', fontSize: '0.72rem' } }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Save button — sticky at bottom right */}
      <Box
        sx={{
          mt: 3,
          display: 'flex',
          justifyContent: 'flex-end',
          position: 'sticky',
          bottom: 20,
          zIndex: 10,
        }}
      >
        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            backgroundColor: 'var(--brand-red)',
            '&:hover': { backgroundColor: 'var(--brand-red-hover)' },
            fontWeight: 700,
            px: 4,
            borderRadius: 'var(--radius-control)',
            boxShadow: '0 4px 16px rgba(211, 47, 47, 0.35)',
            '&:hover:not(:disabled)': {
              backgroundColor: 'var(--brand-red-hover)',
              boxShadow: '0 6px 20px rgba(211, 47, 47, 0.45)',
              transform: 'translateY(-1px)',
            },
          }}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
}
