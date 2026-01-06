// frontend/src/pages/EmployeesPage.jsx

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { 
    Typography, Button, CircularProgress, Alert, Chip, Snackbar, Dialog, DialogTitle, 
    DialogContent, DialogActions, Box, Avatar, Tooltip, IconButton,
    TextField, TablePagination, Switch, Stack // Table components removed, Pagination retained
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import EmployeeForm from '../components/EmployeeForm';
import AdminEmployeeProfileDialog from '../components/AdminEmployeeProfileDialog';
import PageHeroHeader from '../components/PageHeroHeader';
import socket from '../socket';
import '../styles/EmployeesPage.css';

// --- HELPER FUNCTIONS ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
};

// --- SORTING HELPER FUNCTIONS ---
function descendingComparator(a, b, orderBy) {
    const valA = a[orderBy] || '';
    const valB = b[orderBy] || '';
    if (valB < valA) return -1;
    if (valB > valA) return 1;
    return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

const headCells = [
  { id: 'employeeCode', numeric: false, label: 'Employee ID' },
  { id: 'fullName', numeric: false, label: 'Name' },
  { id: 'joiningDate', numeric: false, label: 'Joining Date' },
  { id: 'role', numeric: false, label: 'Role' },
  { id: 'isActive', numeric: false, label: 'Status' },
  { id: 'actions', numeric: true, disableSorting: true, label: 'Actions' },
];

const EmployeesPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [employees, setEmployees] = useState([]);
    const [allShifts, setAllShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, employee: null });
    const [updatingStatus, setUpdatingStatus] = useState({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [profileDialog, setProfileDialog] = useState({ open: false, employee: null, mode: 'view' });
    const initialLoadRef = useRef(true);
    const searchDebounceRef = useRef(null);
    const allEmployeesRef = useRef([]);
    const profileModalOpenedRef = useRef(false);
    
    // State for dynamic features
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('fullName');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const fetchInitialData = useCallback(async () => {
        const useInitialLoader = initialLoadRef.current;
        if (useInitialLoader) {
            setLoading(true);
        } else {
            setIsRefreshing(true);
        }
        try {
            // If searching, fetch all employees for client-side filtering
            // Otherwise, use server-side pagination
            const shouldFetchAll = debouncedSearchTerm.length > 0;
            
            const [empsRes, shiftsRes] = await Promise.all([
                shouldFetchAll 
                    ? api.get('/admin/employees?all=true')
                    : api.get(`/admin/employees?page=${page + 1}&limit=${rowsPerPage}`),
                api.get('/admin/shifts'),
            ]);
            
            // Handle paginated or all employees response
            if (shouldFetchAll) {
                // When fetching all, response is just an array
                const allEmps = Array.isArray(empsRes.data) ? empsRes.data : [];
                setEmployees(allEmps);
                allEmployeesRef.current = allEmps;
                setTotalCount(allEmps.length);
            } else {
                // When paginated, response has employees and totalCount
                let emps = [];
                if (empsRes.data.employees) {
                    emps = Array.isArray(empsRes.data.employees) ? empsRes.data.employees : [];
                    setTotalCount(empsRes.data.totalCount || 0);
                } else {
                    emps = Array.isArray(empsRes.data) ? empsRes.data : [];
                    setTotalCount(emps.length);
                }
                setEmployees(emps);
                // Clear all employees ref when not searching
                allEmployeesRef.current = [];
            }
            
            // Handle paginated response for shifts
            if (shiftsRes.data.shifts) {
                setAllShifts(Array.isArray(shiftsRes.data.shifts) ? shiftsRes.data.shifts : []);
            } else {
                setAllShifts(Array.isArray(shiftsRes.data) ? shiftsRes.data : []);
            }
        } catch (err) {
            setError('Failed to fetch initial page data.');
            console.error(err);
        } finally {
            if (useInitialLoader) {
                setLoading(false);
                initialLoadRef.current = false;
            } else {
                setIsRefreshing(false);
            }
        }
    }, [page, rowsPerPage, debouncedSearchTerm]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);
    
    // POLLING REMOVED: Socket events provide real-time updates
    // Listen for attendance_log_updated events instead of polling
    useEffect(() => {
        if (!socket) return;

        const handleAttendanceUpdate = () => {
            console.log('[EmployeesPage] Received attendance_log_updated event, refreshing data');
            fetchInitialData();
        };

        socket.on('attendance_log_updated', handleAttendanceUpdate);

        // Fallback: Refresh on visibility change if socket disconnected
        const handleVisibilityChange = () => {
            if (!document.hidden && socket.disconnected) {
                console.log('[EmployeesPage] Socket disconnected, refreshing on visibility change');
                fetchInitialData();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            socket.off('attendance_log_updated', handleAttendanceUpdate);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchInitialData]);

    // Handle URL params to open employee profile modal
    useEffect(() => {
        const employeeId = searchParams.get('employeeId');
        const openProfile = searchParams.get('openProfile');
        
        console.log('[EmployeesPage] URL params check:', { employeeId, openProfile, employeesCount: employees.length, loading });
        
        // Reset the ref when params change
        if (!employeeId || openProfile !== 'true') {
            profileModalOpenedRef.current = false;
            return;
        }
        
        // Prevent opening multiple times
        if (profileModalOpenedRef.current) {
            return;
        }
        
        if (employeeId && openProfile === 'true') {
            console.log('[EmployeesPage] Opening profile for employee:', employeeId);
            profileModalOpenedRef.current = true;
            
            // Fetch all employees and find the one we need
            // This is necessary because there's no single employee GET endpoint
            api.get('/admin/employees?all=true')
                .then(({ data }) => {
                    const employeeList = Array.isArray(data) ? data : [];
                    const employee = employeeList.find(emp => emp._id === employeeId || emp._id?.toString() === employeeId);
                    
                    if (employee) {
                        console.log('[EmployeesPage] Employee found, opening modal');
                        // Use a longer delay to ensure the page is fully rendered
                        setTimeout(() => {
                            setProfileDialog({ open: true, employee, mode: 'view' });
                            console.log('[EmployeesPage] Profile dialog opened for:', employee.fullName);
                            // Clean up URL params
                            const newSearchParams = new URLSearchParams(searchParams);
                            newSearchParams.delete('employeeId');
                            newSearchParams.delete('openProfile');
                            setSearchParams(newSearchParams, { replace: true });
                        }, 300);
                    } else {
                        console.warn('[EmployeesPage] Employee not found in list:', employeeId);
                        profileModalOpenedRef.current = false;
                        // Clean up URL params
                        const newSearchParams = new URLSearchParams(searchParams);
                        newSearchParams.delete('employeeId');
                        newSearchParams.delete('openProfile');
                        setSearchParams(newSearchParams, { replace: true });
                    }
                })
                .catch((error) => {
                    console.error('[EmployeesPage] Failed to fetch employees:', error);
                    profileModalOpenedRef.current = false;
                    // Clean up URL params even on error
                    const newSearchParams = new URLSearchParams(searchParams);
                    newSearchParams.delete('employeeId');
                    newSearchParams.delete('openProfile');
                    setSearchParams(newSearchParams, { replace: true });
                });
        }
    }, [searchParams, setSearchParams]);

    // Debounce search term to avoid excessive API calls
    useEffect(() => {
        // Clear existing timeout
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        // If search is cleared, immediately update (no debounce needed)
        if (searchTerm === '') {
            setDebouncedSearchTerm('');
            setPage(0);
            return;
        }

        // Set new timeout for non-empty search terms
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setPage(0); // Reset to first page when search changes
        }, 400); // 400ms debounce delay

        // Cleanup function
        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }
        };
    }, [searchTerm]);

    const handleOpenForm = (employee = null) => {
        setSelectedEmployee(employee);
        setIsFormOpen(true);
    };

    const handleOpenProfileDialog = (employee, mode = 'view') => {
        setProfileDialog({ open: true, employee, mode });
    };

    const handleCloseProfileDialog = () => {
        setProfileDialog({ open: false, employee: null, mode: 'view' });
    };

    const handleOpenAdvancedEditor = () => {
        if (!profileDialog.employee) return;
        const employeeRecord = profileDialog.employee;
        handleCloseProfileDialog();
        setTimeout(() => handleOpenForm(employeeRecord), 0);
    };
    
    const handleCloseForm = () => {
        setSelectedEmployee(null);
        setIsFormOpen(false);
    };

    const handleSaveEmployee = async (employeeData) => {
        try {
            if (selectedEmployee) {
                const { data } = await api.put(`/admin/employees/${selectedEmployee._id}`, employeeData);
                setSnackbar({ open: true, message: data.message || 'Employee updated successfully!', severity: 'success' });
            } else {
                const { data } = await api.post('/admin/employees', employeeData);
                setSnackbar({ open: true, message: data.message || 'Employee added successfully!', severity: 'success' });
            }
            await fetchInitialData();
            handleCloseForm();
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to save employee.', severity: 'error' });
        }
    };

    const confirmDeleteEmployee = async () => {
        const employeeToDelete = deleteDialog.employee;
        if (!employeeToDelete) return;
        try {
            await api.delete(`/admin/employees/${employeeToDelete._id}`);
            setSnackbar({ open: true, message: 'Employee deleted successfully!', severity: 'success' });
            setDeleteDialog({ open: false, employee: null });
            await fetchInitialData();
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to delete employee.', severity: 'error' });
        }
    };

    const handleToggleActive = async (employee, event) => {
        // Prevent row clicks or other handlers
        if (event && event.stopPropagation) event.stopPropagation();

        const id = employee._id;
        const newValue = !employee.isActive;
        setUpdatingStatus(prev => ({ ...prev, [id]: true }));
        try {
            await api.put(`/admin/employees/${id}`, { isActive: newValue });
            setSnackbar({ open: true, message: `${employee.fullName} has been ${newValue ? 'activated' : 'deactivated'}.`, severity: 'success' });
            // Refresh list
            await fetchInitialData();
        } catch (err) {
            console.error('Failed to update employee status:', err);
            setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to update status.', severity: 'error' });
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };
    
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredEmployees = useMemo(() => {
        // If no search term, return employees as-is
        if (!searchTerm) return employees;
        
        // If we have all employees loaded (from search), filter from that ref for immediate response
        // Otherwise, filter from current employees (paginated data)
        const sourceEmployees = allEmployeesRef.current.length > 0 ? allEmployeesRef.current : employees;
        
        return sourceEmployees.filter(employee =>
            employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [employees, searchTerm]);
    
    const visibleRows = useMemo(() => {
        const sorted = stableSort(filteredEmployees, getComparator(order, orderBy));
        
        // If searching, apply client-side pagination (we have all employees)
        // If not searching, data is already paginated from server, so don't slice
        if (searchTerm) {
            return sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
        }
        return sorted;
    }, [filteredEmployees, order, orderBy, page, rowsPerPage, searchTerm]);

    if (loading) return <div className="flex-center"><CircularProgress /></div>;

    return (
        <div className="employees-page">
            <PageHeroHeader
                eyebrow="People Directory"
                title="Manage Employees"
                description="Search, onboard, and keep employee records accurate across shifts and departments."
                actionArea={
                    <Stack
                        direction="row"
                        spacing={1.5}
                        flexWrap="wrap"
                        alignItems="center"
                        className="header-actions"
                    >
                        <TextField
                            size="small"
                            variant="outlined"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                            }}
                            className="search-field"
                        />
                        {isRefreshing && (
                            <CircularProgress size={22} thickness={5} style={{ marginLeft: '0.75rem' }} />
                        )}
                        <Button variant="contained" onClick={() => handleOpenForm()} startIcon={<AddIcon />} className="add-button">
                            Add Employee
                        </Button>
                    </Stack>
                }
            />

            {error && <Alert severity="error" className="error-alert">{error}</Alert>}
            
            <div className="employees-card">
                {/* --- NEW DIV-BASED TABLE --- */}
                <div className="employee-grid-table">
                    <div className="employee-grid-header">
                        <div className="grid-cell serial-number">S.No.</div>
                        {headCells.map((headCell) => (
                            !headCell.disableSorting ? (
                                <div key={headCell.id} className={`grid-cell ${headCell.id}`} onClick={() => handleRequestSort(headCell.id)}>
                                    {headCell.label}
                                    {orderBy === headCell.id && (
                                        <ArrowUpwardIcon className={`sort-arrow ${order}`} />
                                    )}
                                </div>
                            ) : (
                                <div key={headCell.id} className={`grid-cell ${headCell.id}`}>{headCell.label}</div>
                            )
                        ))}
                    </div>
                    <div className="employee-grid-body">
                        {visibleRows.length > 0 ? visibleRows.map((employee, index) => (
                            <div className="employee-grid-row" key={employee._id}>
                                <div className="grid-cell serial-number">{page * rowsPerPage + index + 1}</div>
                                <div className="grid-cell employeeCode">{employee.employeeCode}</div>
                                <div className="grid-cell fullName">
                                    <Avatar>{employee.fullName.charAt(0)}</Avatar>
                                    <div className="employee-text-info">
                                        <div className="employee-name">{employee.fullName}</div>
                                        <div className="employee-email">{employee.email}</div>
                                    </div>
                                </div>
                                <div className="grid-cell joiningDate">{formatDate(employee.joiningDate)}</div>
                                <div className="grid-cell role">{employee.role}</div>
                                <div className="grid-cell isActive">
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Switch
                                            checked={!!employee.isActive}
                                            onChange={(e) => handleToggleActive(employee, e)}
                                            color="primary"
                                            size="small"
                                            inputProps={{ 'aria-label': `Toggle active for ${employee.fullName}` }}
                                        />
                                        {updatingStatus[employee._id] ? (
                                            <CircularProgress size={16} />
                                        ) : (
                                            <Chip label={employee.isActive ? 'Active' : 'Inactive'} color={employee.isActive ? 'success' : 'error'} size="small" variant="outlined" />
                                        )}
                                    </Box>
                                </div>
                                <div className="grid-cell actions">
                                    <Tooltip title="View Details">
                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenProfileDialog(employee, 'view'); }}>
                                            <VisibilityOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit Profile">
                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenForm(employee); }}>
                                            <EditOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete"><IconButton size="small" onClick={() => setDeleteDialog({ open: true, employee })}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                                </div>
                            </div>
                        )) : (
                            <div className="empty-state">No employees found.</div>
                        )}
                    </div>
                </div>
                
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    component="div"
                    count={searchTerm ? filteredEmployees.length : totalCount}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </div>

            <EmployeeForm open={isFormOpen} onClose={handleCloseForm} onSave={handleSaveEmployee} employee={selectedEmployee} shifts={allShifts} />
            
            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, employee: null })}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete employee "{deleteDialog.employee?.fullName}"? 
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({ open: false, employee: null })}>
                        Cancel
                    </Button>
                    <Button onClick={confirmDeleteEmployee} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
            </Snackbar>

            <AdminEmployeeProfileDialog
                open={profileDialog.open}
                mode={profileDialog.mode}
                employee={profileDialog.employee}
                onClose={handleCloseProfileDialog}
                onSaved={async () => {
                    await fetchInitialData();
                    handleCloseProfileDialog();
                }}
                onOpenAdvancedEditor={profileDialog.employee ? handleOpenAdvancedEditor : undefined}
            />
        </div>
    );
};

export default EmployeesPage;