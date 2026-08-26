// src/theme.js — Payroll design system, derived from AMS tokens
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary:   { main: '#d32f2f', dark: '#b71c1c', contrastText: '#fff' },
    secondary: { main: '#192a56', contrastText: '#fff' },
    success:   { main: '#15803d', light: '#dcfce7', contrastText: '#fff' },
    warning:   { main: '#b45309', light: '#fef9c3', contrastText: '#fff' },
    info:      { main: '#1e40af', light: '#dbeafe', contrastText: '#fff' },
    background: { default: '#f4f7fb', paper: '#ffffff' },
    text: {
      primary:   '#1a202c',
      secondary: '#6b7280',
      disabled:  '#9aa3b2',
    },
    divider: '#e5e7eb',
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    h4: { fontWeight: 700, color: '#1a202c' },
    h5: { fontWeight: 700, color: '#1a202c' },
    h6: { fontWeight: 600, color: '#1a202c' },
    body1: { color: '#1a202c' },
    body2: { color: '#1a202c' },
    caption: { color: '#6b7280' },
  },
  shape: { borderRadius: 8 },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.05)',
    '0 2px 8px rgba(0,0,0,0.10)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
    '0 4px 16px rgba(0,0,0,0.15)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          transition: 'all 0.18s ease',
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.15)', transform: 'translateY(-1px)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          border: '1px solid #e5e7eb',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 16, border: '1px solid #e5e7eb' },
        elevation1: { boxShadow: '0 2px 8px rgba(0,0,0,0.10)' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#192a56',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.8125rem',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: '#f4f7fb' },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: '#e5e7eb', fontSize: '0.875rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 16, fontWeight: 600, fontSize: '0.75rem' },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': { borderColor: '#e5e7eb' },
            '&:hover fieldset': { borderColor: '#9aa3b2' },
            '&.Mui-focused fieldset': { borderColor: '#d32f2f' },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#192a56',
          fontSize: '0.75rem',
          borderRadius: 6,
          padding: '6px 12px',
        },
      },
    },
  },
});

export default theme;
