// frontend/src/pages/AdminRequestsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, MenuItem, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Snackbar, Alert,
} from '@mui/material';
import { Inventory2 } from '@mui/icons-material';
import api from '../api/axios';
import PageHeroHeader from '../components/PageHeroHeader';
import { TableSkeleton } from '../components/SkeletonLoaders';
import '../styles/RequestsPage.css';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Fulfilled', 'Rejected'];

const statusColor = (status) => {
  const map = {
    Pending: 'warning',
    'In Progress': 'info',
    Fulfilled: 'success',
    Rejected: 'error',
    Cancelled: 'default',
  };
  return map[status] || 'default';
};

const AdminRequestsPage = ({ embedded = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('In Progress');
  const [updating, setUpdating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: rowsPerPage };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get('/resource-requests', { params });
      setRequests(data.requests || []);
      setTotalCount(data.totalCount || 0);
      setCategories(data.categories || []);
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to load requests.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter, search]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const requestId = searchParams.get('requestId');
    if (!requestId) return;
    const openById = async () => {
      try {
        const { data } = await api.get(`/resource-requests/${requestId}`);
        if (data.request) {
          setSelected(data.request);
          setAdminNotes(data.request.adminNotes || '');
          setNewStatus(data.request.status === 'Pending' ? 'In Progress' : data.request.status);
          setDetailOpen(true);
        }
      } catch {
        /* list fetch may still show it */
      }
      setSearchParams({}, { replace: true });
    };
    openById();
  }, [searchParams, setSearchParams]);

  const openDetail = (req) => {
    setSelected(req);
    setAdminNotes(req.adminNotes || '');
    setNewStatus(req.status === 'Pending' ? 'In Progress' : req.status);
    setDetailOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      await api.patch(`/resource-requests/${selected._id}/status`, {
        status: newStatus,
        adminNotes,
      });
      setSnackbar({ open: true, message: 'Request updated.', severity: 'success' });
      setDetailOpen(false);
      fetchRequests();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Update failed.', severity: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const categoryLabel = (req) => (req.category === 'Other' && req.customCategory ? req.customCategory : req.category);

  return (
    <Box className="requests-page">
      {!embedded && (
        <PageHeroHeader
          eyebrow="Admin"
          title="Resource Requests"
          description="Review and manage employee requests for stationery, IT hardware, and other workplace resources."
          icon={<Inventory2 />}
        />
      )}

      <Paper className="requests-list-card" sx={{ p: 2 }}>
        <Box className="admin-requests-filters">
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
            <MenuItem value="Cancelled">Cancelled</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRequests()}
            placeholder="Name, title, code..."
            sx={{ minWidth: 220 }}
          />
          <Button variant="outlined" size="small" onClick={() => { setPage(0); fetchRequests(); }}>Apply</Button>
        </Box>

        {loading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req._id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(req)}>
                      <TableCell>{new Date(req.createdAt).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{req.employeeName}</TableCell>
                      <TableCell>{categoryLabel(req)}</TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>
                        <Chip size="small" label={req.status} color={statusColor(req.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          </>
        )}
      </Paper>

      <Dialog
        open={detailOpen}
        onClose={() => !updating && setDetailOpen(false)}
        maxWidth="sm"
        fullWidth
        className="resource-request-dialog"
      >
        {selected && (
          <>
            <DialogTitle>{selected.title}</DialogTitle>
            <DialogContent>
              <div className="resource-summary-panel">
                <Typography className="resource-summary-title">
                  {selected.employeeName}
                  {selected.employeeCode ? ` (${selected.employeeCode})` : ''}
                </Typography>
                <Typography className="resource-summary-meta">
                  {selected.department ? `${selected.department} · ` : ''}
                  {categoryLabel(selected)} · Qty {selected.quantity}
                </Typography>
                <div className="resource-summary-chips">
                  <Chip size="small" label={selected.status} color={statusColor(selected.status)} />
                  {selected.priority && (
                    <Chip size="small" variant="outlined" label={`${selected.priority} priority`} />
                  )}
                </div>
              </div>
              <Typography className="resource-form-section-label">Description</Typography>
              <Typography variant="body2" paragraph sx={{ color: '#334155', lineHeight: 1.6, mb: 2 }}>
                {selected.description}
              </Typography>
              {selected.status !== 'Cancelled' && selected.status !== 'Fulfilled' && selected.status !== 'Rejected' && (
                <>
                  <Typography className="resource-form-section-label">Update request</Typography>
                  <div className="resource-admin-fields">
                    <TextField
                      select
                      fullWidth
                      variant="outlined"
                      label="Update status"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      fullWidth
                      variant="outlined"
                      multiline
                      minRows={3}
                      maxRows={6}
                      label="Admin notes (optional)"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add context for the employee (delivery date, rejection reason, etc.)"
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailOpen(false)} disabled={updating}>Close</Button>
              {selected.status !== 'Cancelled' && selected.status !== 'Fulfilled' && selected.status !== 'Rejected' && (
                <Button variant="contained" onClick={handleUpdateStatus} disabled={updating}>
                  {updating ? 'Saving...' : 'Save'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminRequestsPage;
