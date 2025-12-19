// Test version of EmployeeAnalyticsModal to isolate React error
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

const EmployeeAnalyticsModalTest = ({ open, onClose, employeeId, employeeName }) => {
  const [loading, setLoading] = useState(false);

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {employeeName || 'Employee'} Analytics (Test)
      </DialogTitle>
      <DialogContent>
        <p>This is a test version to isolate the React error.</p>
        <p>Employee ID: {employeeId}</p>
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmployeeAnalyticsModalTest;
