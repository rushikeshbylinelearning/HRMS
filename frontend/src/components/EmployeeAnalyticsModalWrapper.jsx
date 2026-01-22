// Wrapper component to isolate React error
import React, { Suspense, ErrorBoundary } from 'react';
import { Alert } from '@mui/material';

// Lazy load the actual component
const EmployeeAnalyticsModal = React.lazy(() => import('./EmployeeAnalyticsModal'));

import { SkeletonBox } from '../components/SkeletonLoaders';
const EmployeeAnalyticsModalWrapper = (props) => {
  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error">
          Error loading analytics modal. Please try again.
        </Alert>
      }
    >
      <Suspense fallback={<SkeletonBox width="24px" height="24px" borderRadius="50%" />}>
        <EmployeeAnalyticsModal {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default EmployeeAnalyticsModalWrapper;
