// Wrapper component to isolate React error
import React, { Suspense, ErrorBoundary } from 'react';
import { CircularProgress, Alert } from '@mui/material';

// Lazy load the actual component
const EmployeeAnalyticsModal = React.lazy(() => import('./EmployeeAnalyticsModal'));

const EmployeeAnalyticsModalWrapper = (props) => {
  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error">
          Error loading analytics modal. Please try again.
        </Alert>
      }
    >
      <Suspense fallback={<CircularProgress />}>
        <EmployeeAnalyticsModal {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default EmployeeAnalyticsModalWrapper;
