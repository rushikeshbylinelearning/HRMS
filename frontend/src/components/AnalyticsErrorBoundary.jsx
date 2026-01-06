// frontend/src/components/AnalyticsErrorBoundary.jsx
import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

class AnalyticsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('Analytics Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <Box sx={{ p: 3, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Analytics Page Error
            </Typography>
            <Typography variant="body2" gutterBottom>
              Something went wrong while loading the analytics page. This might be due to a component error or data loading issue.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'monospace' }}>
              {this.state.error && this.state.error.toString()}
            </Typography>
          </Alert>
          
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button 
              variant="contained" 
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            >
              Try Again
            </Button>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default AnalyticsErrorBoundary;



