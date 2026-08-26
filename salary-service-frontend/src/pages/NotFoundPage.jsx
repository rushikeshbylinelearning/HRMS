import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { HomeOutlined } from '@mui/icons-material';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      {/* Large numeral */}
      <Typography
        sx={{
          fontSize: { xs: '6rem', sm: '9rem' },
          fontWeight: 800,
          lineHeight: 1,
          color: 'var(--border)',
          letterSpacing: '-0.04em',
          userSelect: 'none',
          mb: 1,
        }}
      >
        404
      </Typography>

      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: 'var(--ink)', mb: 1 }}
      >
        Page not found
      </Typography>

      <Typography
        variant="body2"
        sx={{ color: 'var(--ink-secondary)', mb: 4, maxWidth: 340 }}
      >
        The page you're looking for doesn't exist or you don't have permission to view it.
      </Typography>

      <Button
        variant="contained"
        startIcon={<HomeOutlined />}
        onClick={() => navigate('/')}
        sx={{
          backgroundColor: 'var(--brand-red)',
          '&:hover': { backgroundColor: 'var(--brand-red-hover)' },
          fontWeight: 600,
          borderRadius: 'var(--radius-control)',
          px: 3,
        }}
      >
        Back to Dashboard
      </Button>
    </Box>
  );
}
