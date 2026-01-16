// frontend/src/pages/LeavesTrackerPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Menu,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Switch,
  Paper,
  Divider,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  Stack,
  TablePagination,
  Skeleton
} from '@mui/material';
import {
  ArrowBack,
  Search,
  Add,
  Assignment,
  History,
  SwapHoriz as SwapHorizIcon,
  CalendarMonth as CalendarMonthIcon,
  Group,
  ArrowUpward,
  AttachMoney,
  CheckCircle,
  Cancel,
  Pending,
  TrendingUp,
  AccountBalance,
  ExpandMore,
  CalendarToday
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import AdminLeaveForm from '../components/AdminLeaveForm';
import '../styles/LeavesTrackerPage.css';

// --- Enhanced Saturday Schedule Manager Component with Drag & Drop ---
const SaturdayScheduleManager = ({ employees, onUpdate }) => {
    const [localEmployees, setLocalEmployees] = useState(employees);
    const [loadingMap, setLoadingMap] = useState({});
    const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState(() => {
        return sessionStorage.getItem('saturdayScheduleDepartmentFilter') || '';
    });
    const [searchFilter, setSearchFilter] = useState(() => {
        return sessionStorage.getItem('saturdayScheduleSearchFilter') || '';
    });
    const [viewMode, setViewMode] = useState(() => {
        // Persist view mode in sessionStorage
        const savedViewMode = sessionStorage.getItem('saturdayScheduleViewMode');
        return savedViewMode || 'grid';
    });
    const [draggedEmployee, setDraggedEmployee] = useState(null);
    const [dragOverCategory, setDragOverCategory] = useState(null);

    useEffect(() => {
        setLocalEmployees(employees);
    }, [employees]);

    // Persist view mode to sessionStorage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('saturdayScheduleViewMode', viewMode);
    }, [viewMode]);

    // Persist department filter to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('saturdayScheduleDepartmentFilter', selectedDepartmentFilter);
    }, [selectedDepartmentFilter]);

    // Persist search filter to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('saturdayScheduleSearchFilter', searchFilter);
    }, [searchFilter]);

    const handleSwapPolicy = async (employee) => {
        const currentPolicy = employee.alternateSaturdayPolicy;
        let newPolicy;

        if (currentPolicy === 'Week 1 & 3 Off') {
            newPolicy = 'Week 2 & 4 Off';
        } else if (currentPolicy === 'Week 2 & 4 Off') {
            newPolicy = 'Week 1 & 3 Off';
        } else {
            newPolicy = 'Week 1 & 3 Off';
        }

        setLoadingMap(prev => ({ ...prev, [employee._id]: true }));

        // Optimistically update local state for immediate UI feedback
        const updatedEmployees = localEmployees.map(emp => 
            emp._id === employee._id 
                ? { ...emp, alternateSaturdayPolicy: newPolicy }
                : emp
        );
        setLocalEmployees(updatedEmployees);

        try {
            await axios.patch(`/admin/employees/${employee._id}/saturday-policy`, { newPolicy });
            onUpdate();
        } catch (error) {
            console.error("Failed to swap policy:", error);
            // Revert optimistic update on error
            setLocalEmployees(localEmployees);
        } finally {
            setLoadingMap(prev => ({ ...prev, [employee._id]: false }));
        }
    };

    // Drag and Drop Handlers
    const handleDragStart = (e, employee) => {
        setDraggedEmployee(employee);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget);
        e.currentTarget.style.opacity = '0.4';
    };

    const handleDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
        setDraggedEmployee(null);
        setDragOverCategory(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    };

    const handleDragEnter = (category) => {
        setDragOverCategory(category);
    };

    const handleDragLeave = () => {
        setDragOverCategory(null);
    };

    const handleDrop = async (e, targetCategory) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (!draggedEmployee) return;

        const policyMap = {
            'firstAndThirdOff': 'Week 1 & 3 Off',
            'secondAndFourthOff': 'Week 2 & 4 Off',
            'allWorking': 'All Saturdays Working',
            'allOff': 'All Saturdays Off'
        };

        const newPolicy = policyMap[targetCategory];
        
        if (newPolicy && draggedEmployee.alternateSaturdayPolicy !== newPolicy) {
            setLoadingMap(prev => ({ ...prev, [draggedEmployee._id]: true }));
            
            // Optimistically update local state for immediate UI feedback
            const updatedEmployees = localEmployees.map(emp => 
                emp._id === draggedEmployee._id 
                    ? { ...emp, alternateSaturdayPolicy: newPolicy }
                    : emp
            );
            setLocalEmployees(updatedEmployees);
            
            try {
                await axios.patch(`/admin/employees/${draggedEmployee._id}/saturday-policy`, { newPolicy });
                // Call onUpdate to sync with parent, but local state already updated
                onUpdate();
            } catch (error) {
                console.error("Failed to update policy:", error);
                // Revert optimistic update on error
                setLocalEmployees(localEmployees);
            } finally {
                setLoadingMap(prev => ({ ...prev, [draggedEmployee._id]: false }));
            }
        }

        setDraggedEmployee(null);
        setDragOverCategory(null);
        return false;
    };

    // Get unique departments
    const departments = useMemo(() => {
        const deptSet = new Set(localEmployees.map(emp => emp.department).filter(Boolean));
        return Array.from(deptSet).sort();
    }, [localEmployees]);

    // Filter employees based on search and department
    const filteredEmployees = useMemo(() => {
        return localEmployees.filter(emp => {
            const matchesSearch = !searchFilter || 
                emp.fullName.toLowerCase().includes(searchFilter.toLowerCase()) ||
                emp.employeeCode.toLowerCase().includes(searchFilter.toLowerCase());
            const matchesDept = !selectedDepartmentFilter || emp.department === selectedDepartmentFilter;
            return matchesSearch && matchesDept;
        });
    }, [localEmployees, searchFilter, selectedDepartmentFilter]);

    const categorizedSchedules = useMemo(() => {
        const schedules = {
            firstAndThirdOff: [],
            secondAndFourthOff: [],
            allWorking: [],
            allOff: []
        };
        filteredEmployees.forEach(emp => {
            switch (emp.alternateSaturdayPolicy) {
                case 'Week 1 & 3 Off': schedules.firstAndThirdOff.push(emp); break;
                case 'Week 2 & 4 Off': schedules.secondAndFourthOff.push(emp); break;
                case 'All Saturdays Working': schedules.allWorking.push(emp); break;
                case 'All Saturdays Off': schedules.allOff.push(emp); break;
                default: break;
            }
        });
        return schedules;
    }, [filteredEmployees]);

    // Group by department
    const departmentGroups = useMemo(() => {
        const groups = {};
        filteredEmployees.forEach(emp => {
            const dept = emp.department || 'Unassigned';
            if (!groups[dept]) {
                groups[dept] = {
                    firstAndThirdOff: [],
                    secondAndFourthOff: [],
                    allWorking: [],
                    allOff: []
                };
            }
            switch (emp.alternateSaturdayPolicy) {
                case 'Week 1 & 3 Off': groups[dept].firstAndThirdOff.push(emp); break;
                case 'Week 2 & 4 Off': groups[dept].secondAndFourthOff.push(emp); break;
                case 'All Saturdays Working': groups[dept].allWorking.push(emp); break;
                case 'All Saturdays Off': groups[dept].allOff.push(emp); break;
                default: break;
            }
        });
        return groups;
    }, [filteredEmployees]);

    const EmployeeChip = ({ emp, color }) => (
        <Chip
            key={emp._id}
            avatar={<Avatar sx={{ bgcolor: '#dc3545', color: 'white' }}>{emp.fullName.charAt(0)}</Avatar>}
            label={
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 0.5 }}>
                    <Typography variant="body2" fontWeight="600" sx={{ color: '#000' }}>{emp.fullName}</Typography>
                    <Typography variant="caption" sx={{ color: '#666' }}>{emp.employeeCode} • {emp.department || 'N/A'}</Typography>
                </Box>
            }
            deleteIcon={loadingMap[emp._id] ? <CircularProgress size={18} /> : <SwapHorizIcon />}
            onDelete={() => handleSwapPolicy(emp)}
            draggable
            onDragStart={(e) => handleDragStart(e, emp)}
            onDragEnd={handleDragEnd}
            sx={{ 
                height: 'auto', 
                py: 1, 
                px: 1.5,
                mb: 1.5,
                mr: 1.5,
                borderRadius: '8px',
                bgcolor: 'white',
                cursor: 'grab',
                border: '2px solid #dc3545',
                '& .MuiChip-label': { display: 'block', whiteSpace: 'normal' },
                transition: 'all 0.3s ease',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)',
                    borderColor: '#dc3545',
                    bgcolor: '#fff'
                },
                '&:active': {
                    cursor: 'grabbing'
                }
            }}
        />
    );

    const EmployeeList = ({ title, employees, color, icon, category }) => {
        const isDragOver = dragOverCategory === category;
        
        return (
            <Card 
                variant="outlined" 
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(category)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, category)}
                sx={{ 
                    flex: 1, 
                    borderRadius: '8px',
                    boxShadow: 'none',
                    transition: 'all 0.3s ease',
                    border: isDragOver ? '3px dashed #dc3545' : '2px solid #dc3545',
                    bgcolor: isDragOver ? '#f8f9fa' : 'white',
                    transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
                    '&:hover': {
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        borderColor: '#dc3545'
                    }
                }}
            >
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
                        {icon}
                        <Typography variant="h6" fontWeight="bold" sx={{ ml: 1, color: '#000' }}>{title}</Typography>
                        <Chip 
                            label={employees.length} 
                            size="small" 
                            sx={{ 
                                ml: 'auto', 
                                fontWeight: 'bold', 
                                bgcolor: '#dc3545', 
                                color: 'white',
                                border: '1px solid #dc3545'
                            }}
                        />
                    </Box>
                    <Box sx={{ 
                        minHeight: 200,
                        maxHeight: 400, 
                        overflowY: 'auto', 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        p: 1
                    }}>
                        {employees.length === 0 ? (
                            <Box sx={{ 
                                py: 4, 
                                textAlign: 'center', 
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                <Typography variant="body2" sx={{ color: '#666' }}>
                                    {isDragOver ? 'Drop employee here' : 'No employees in this category'}
                                </Typography>
                                {isDragOver && (
                                    <Typography variant="caption" sx={{ color: '#dc3545', fontWeight: 'bold' }}>
                                        Release to assign
                                    </Typography>
                                )}
                            </Box>
                        ) : (
                            employees.map(emp => <EmployeeChip key={emp._id} emp={emp} color={color} />)
                        )}
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const DepartmentView = () => (
        <Box sx={{ mt: 3 }}>
            {Object.entries(departmentGroups).map(([dept, schedules]) => (
                <Card key={dept} sx={{ 
                    mb: 3, 
                    borderRadius: '8px', 
                    boxShadow: 'none',
                    border: '2px solid #000',
                    bgcolor: 'white'
                }}>
                    <CardContent>
                        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3, color: '#000' }}>
                            {dept}
                            <Chip 
                                label={`${Object.values(schedules).flat().length} employees`}
                                size="small"
                                sx={{ 
                                    ml: 2, 
                                    bgcolor: '#dc3545', 
                                    color: 'white', 
                                    fontWeight: 'bold',
                                    border: '1px solid #dc3545'
                                }}
                            />
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <EmployeeList 
                                    title="1st & 3rd Saturdays Off" 
                                    employees={schedules.firstAndThirdOff}
                                    color="white"
                                    icon={<CalendarMonthIcon sx={{ color: '#dc3545' }} />}
                                    category="firstAndThirdOff"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <EmployeeList 
                                    title="2nd & 4th Saturdays Off" 
                                    employees={schedules.secondAndFourthOff}
                                    color="white"
                                    icon={<CalendarMonthIcon sx={{ color: '#dc3545' }} />}
                                    category="secondAndFourthOff"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <EmployeeList 
                                    title="All Saturdays Working" 
                                    employees={schedules.allWorking}
                                    color="white"
                                    icon={<Assignment sx={{ color: '#dc3545' }} />}
                                    category="allWorking"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <EmployeeList 
                                    title="All Saturdays Off" 
                                    employees={schedules.allOff}
                                    color="white"
                                    icon={<History sx={{ color: '#dc3545' }} />}
                                    category="allOff"
                                />
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            ))}
        </Box>
    );

    const GridView = () => (
        <Box sx={{ mt: 3 }}>
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <EmployeeList 
                        title="Off on 1st & 3rd Saturdays" 
                        employees={categorizedSchedules.firstAndThirdOff}
                        color="white"
                        icon={<CalendarMonthIcon sx={{ color: '#dc3545' }} />}
                        category="firstAndThirdOff"
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <EmployeeList 
                        title="Off on 2nd & 4th Saturdays" 
                        employees={categorizedSchedules.secondAndFourthOff}
                        color="white"
                        icon={<CalendarMonthIcon sx={{ color: '#dc3545' }} />}
                        category="secondAndFourthOff"
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <EmployeeList 
                        title="All Saturdays Working" 
                        employees={categorizedSchedules.allWorking}
                        color="white"
                        icon={<Assignment sx={{ color: '#dc3545' }} />}
                        category="allWorking"
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <EmployeeList 
                        title="All Saturdays Off" 
                        employees={categorizedSchedules.allOff}
                        color="white"
                        icon={<History sx={{ color: '#dc3545' }} />}
                        category="allOff"
                    />
                </Grid>
            </Grid>
        </Box>
    );

    return (
        <Box>
            {/* Statistics Overview */}
            <Card sx={{ 
                mb: 3, 
                borderRadius: '8px', 
                background: 'white',
                border: '2px solid #000',
                boxShadow: 'none'
            }}>
                <CardContent>
                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 3, color: '#000' }}>
                        Saturday Schedule Overview
                    </Typography>
                    <Grid container spacing={3}>
                        <Grid item xs={6} sm={3}>
                            <Box sx={{ 
                                textAlign: 'center',
                                p: 2,
                                borderRadius: '8px',
                                border: '2px solid #dc3545',
                                background: 'white',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    background: '#f8f9fa',
                                    transform: 'translateY(-4px)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                }
                            }}>
                                <Typography variant="h3" fontWeight="bold" sx={{ color: '#000' }}>{categorizedSchedules.firstAndThirdOff.length}</Typography>
                                <Typography variant="body2" sx={{ color: '#666' }}>1st & 3rd Off</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Box sx={{ 
                                textAlign: 'center',
                                p: 2,
                                borderRadius: '8px',
                                border: '2px solid #dc3545',
                                background: 'white',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    background: '#f8f9fa',
                                    transform: 'translateY(-4px)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                }
                            }}>
                                <Typography variant="h3" fontWeight="bold" sx={{ color: '#000' }}>{categorizedSchedules.secondAndFourthOff.length}</Typography>
                                <Typography variant="body2" sx={{ color: '#666' }}>2nd & 4th Off</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Box sx={{ 
                                textAlign: 'center',
                                p: 2,
                                borderRadius: '8px',
                                border: '2px solid #dc3545',
                                background: 'white',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    background: '#f8f9fa',
                                    transform: 'translateY(-4px)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                }
                            }}>
                                <Typography variant="h3" fontWeight="bold" sx={{ color: '#000' }}>{categorizedSchedules.allWorking.length}</Typography>
                                <Typography variant="body2" sx={{ color: '#666' }}>All Working</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Box sx={{ 
                                textAlign: 'center',
                                p: 2,
                                borderRadius: '8px',
                                border: '2px solid #dc3545',
                                background: 'white',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    background: '#f8f9fa',
                                    transform: 'translateY(-4px)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                }
                            }}>
                                <Typography variant="h3" fontWeight="bold" sx={{ color: '#000' }}>{categorizedSchedules.allOff.length}</Typography>
                                <Typography variant="body2" sx={{ color: '#666' }}>All Off</Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Filters and View Toggle */}
            <Card sx={{ mb: 3, borderRadius: '8px', boxShadow: 'none', border: '2px solid #e0e0e0', bgcolor: 'white' }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Search employees..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                InputProps={{
                                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Department</InputLabel>
                                <Select
                                    value={selectedDepartmentFilter}
                                    label="Department"
                                    onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
                                >
                                    <MenuItem value="">All Departments</MenuItem>
                                    {departments.map(dept => (
                                        <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={12} md={4}>
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                <Button
                                    variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                                    onClick={() => setViewMode('grid')}
                                    sx={{ flex: 1 }}
                                >
                                    Grid View
                                </Button>
                                <Button
                                    variant={viewMode === 'department' ? 'contained' : 'outlined'}
                                    onClick={() => setViewMode('department')}
                                    sx={{ flex: 1 }}
                                >
                                    Department View
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* View Content */}
            {viewMode === 'grid' ? <GridView /> : <DepartmentView />}
        </Box>
    );
};


const LeavesTrackerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaveData, setLeaveData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // UPGRADED: Pagination state for Leave Balances table
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  
  const [activeTab, setActiveTab] = useState(0);
  const [leaveRequests, setLeaveRequests] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedWeek, setSelectedWeek] = useState('');
    const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
    const [dialogEmployee, setDialogEmployee] = useState(null);
        const [selectedRequest, setSelectedRequest] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [showBulkAllocateDialog, setShowBulkAllocateDialog] = useState(false);
  const [isAssigningLeave, setIsAssigningLeave] = useState(false);
  const [assignLeaveRequest, setAssignLeaveRequest] = useState(null);
  const [yearEndHistory, setYearEndHistory] = useState([]);
  const [loadingYearEndHistory, setLoadingYearEndHistory] = useState(false);
  const [dialogSelectedYear, setDialogSelectedYear] = useState(new Date().getFullYear());
  const [leaveUsageData, setLeaveUsageData] = useState(null);
  const [loadingLeaveUsage, setLoadingLeaveUsage] = useState(false);
  const [allocateForm, setAllocateForm] = useState({
    employeeId: '', sickLeaveEntitlement: 12, casualLeaveEntitlement: 12, paidLeaveEntitlement: 0, year: new Date().getFullYear() });
  const [bulkAllocateForm, setBulkAllocateForm] = useState({
    employeeIds: [], sickLeaveEntitlement: 12, casualLeaveEntitlement: 12, paidLeaveEntitlement: 0, year: new Date().getFullYear() });

  // UPGRADED: Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchAllData = useCallback(async () => {
      setLoading(true);
      try {
          const [empRes, reqRes] = await Promise.all([
              axios.get('/admin/employees?all=true'),
              axios.get('/admin/leaves/all')
          ]);
  
          const employeesData = empRes.data || [];
          setEmployees(employeesData);
          // Normalize leave requests: ensure each request has an employee object with department and other details
          const rawRequests = reqRes.data.requests || [];
          // Filter out YEAR_END requests from normal leave requests
          const normalRequests = rawRequests.filter(r => r.requestType !== 'YEAR_END');
          const normalizedRequests = normalRequests.map(r => {
              const req = { ...r };
              let empObj = req.employee;
              // If request only contains employee id or a minimal object, try to resolve full employee data
              const empId = (empObj && empObj._id) ? empObj._id : (typeof empObj === 'string' ? empObj : empObj && (empObj.employeeId || empObj.id));
              if (!empObj || !empObj._id) {
                  const found = employeesData.find(e => e._id === empId || e.employeeCode === empId || e._id === (empObj && empObj._id));
                  if (found) empObj = found;
              } else {
                  // If we have an object but departments missing, try to merge from employeesData
                  const found = employeesData.find(e => e._id === empObj._id);
                  if (found) empObj = { ...found, ...empObj };
              }
              req.employee = empObj || {};
              return req;
          });
          setLeaveRequests(normalizedRequests);
  
          // The leaveData is now directly derived from the comprehensive employee data
          const processedLeaveData = employeesData.map(employee => {
              const employeeLeaves = (reqRes.data.requests || []).filter(
                  req => req.employee._id === employee._id && new Date(req.createdAt).getFullYear() === selectedYear
              );
              const balances = calculateLeaveBalances(employeeLeaves, employee);
              return { employee, leaves: employeeLeaves, balances };
          });
          setLeaveData(processedLeaveData);
  
      } catch (error) {
          console.error('Error fetching data:', error);
          setError('Failed to fetch initial data');
      } finally {
          setLoading(false);
      }
  }, [selectedYear]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const calculateLeaveBalances = (leaves, employee) => {
    // FIXED: Backend is source of truth for balances - no frontend calculation
    // Use backend-provided balances and entitlements directly
    const entitlements = {
        sick: employee.leaveEntitlements?.sick ?? 12,
        casual: employee.leaveEntitlements?.casual ?? 12,
        paid: employee.leaveEntitlements?.paid ?? 0,
    };

    const balances = {
        sick: employee.leaveBalances?.sick ?? entitlements.sick,
        casual: employee.leaveBalances?.casual ?? entitlements.casual,
        paid: employee.leaveBalances?.paid ?? entitlements.paid,
    };

    // Calculate used from entitlements - balances (backend already deducted)
    const used = {
        sick: Math.max(0, entitlements.sick - balances.sick),
        casual: Math.max(0, entitlements.casual - balances.casual),
        paid: Math.max(0, entitlements.paid - balances.paid),
        unpaid: 0, // LOP doesn't deduct from balance
    };

    // Count LOP days separately (doesn't affect balance)
    leaves.forEach(leave => {
        if (leave.status === 'Approved' && leave.requestType === 'Loss of Pay') {
            const days = leave.leaveDates.length * (leave.leaveType?.startsWith('Half Day') ? 0.5 : 1);
            used.unpaid += days;
        }
    });

    const totalUsed = used.sick + used.casual + used.paid;
    const totalEntitlement = entitlements.sick + entitlements.casual + entitlements.paid;

    return {
        entitlements,
        used,
        balances,
        totalUsed,
        totalEntitlement,
    };
  };

  // UPGRADED: Better memoization with debounced search and proper dependency tracking
  // FIXED PART 1: Filter to show ONLY Permanent Employees in Leave Balances tab
  const filteredLeaveData = useMemo(() => {
    if (!leaveData || leaveData.length === 0) return [];
    
    return leaveData.filter(data => {
      const emp = data.employee;
      if (!emp) return false;
      
      // PART 1 FIX: Exclude Probation and Intern employees from Leave Balances
      // Only show employees with employmentStatus === 'Permanent' OR probationStatus === 'Permanent'
      const isPermanent = emp.employmentStatus === 'Permanent' || emp.probationStatus === 'Permanent';
      if (!isPermanent) return false;
      
      const matchesSearch = !debouncedSearchTerm || 
        (emp.fullName && emp.fullName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (emp.employeeCode && emp.employeeCode.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      const matchesDepartment = !selectedDepartment || emp.department === selectedDepartment;
      const matchesEmployee = !selectedEmployee || emp._id === selectedEmployee;
      
      return matchesSearch && matchesDepartment && matchesEmployee;
    });
  }, [leaveData, debouncedSearchTerm, selectedDepartment, selectedEmployee]);

  // UPGRADED: Paginated leave data for current page
  const paginatedLeaveData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredLeaveData.slice(startIndex, endIndex);
  }, [filteredLeaveData, page, rowsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, selectedDepartment, selectedEmployee, selectedYear]);

  const departments = useMemo(() => {
    const deptSet = new Set(employees.map(emp => emp.department).filter(Boolean));
    return Array.from(deptSet).sort();
  }, [employees]);

  // FIXED: Memoize filtered leave requests to prevent recalculation on every render
  const filteredLeaveRequests = useMemo(() => {
    const getWeekOfMonth = (d) => {
      try {
        const date = new Date(d);
        if (isNaN(date)) return null;
        return Math.ceil(date.getDate() / 7);
      } catch (e) { return null; }
    };

    return leaveRequests.filter(req => {
      const emp = req.employee || {};
      // year filter (use first leave date if available)
      const firstDateStr = Array.isArray(req.leaveDates) && req.leaveDates.length ? req.leaveDates[0] : req.createdAt || null;
      const firstDate = firstDateStr ? new Date(firstDateStr) : null;
      if (selectedYear && firstDate && firstDate.getFullYear() !== Number(selectedYear)) return false;

      if (selectedMonth !== '' && firstDate) {
        if (firstDate.getMonth() !== Number(selectedMonth)) return false;
      }
      if (selectedWeek !== '' && firstDate) {
        const wk = getWeekOfMonth(firstDate);
        if (wk !== Number(selectedWeek)) return false;
      }

      if (selectedDepartment && emp.department !== selectedDepartment) return false;
      if (selectedEmployee && emp._id !== selectedEmployee) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const name = (emp.fullName || '').toLowerCase();
        const code = (emp.employeeCode || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !(req.requestType || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [leaveRequests, selectedYear, selectedMonth, selectedWeek, selectedDepartment, selectedEmployee, searchTerm]);
  
  const handleAssignLeave = async (formData) => {
    setIsAssigningLeave(true);
    try {
      // Convert date to ISO string format
      const leaveDates = formData.leaveDates.filter(d => d !== null).map(d => new Date(d).toISOString());
      
      if (leaveDates.length === 0) {
        setSnackbar({ open: true, message: 'Please select at least one leave date', severity: 'error' });
        setIsAssigningLeave(false);
        return;
      }

      const payload = {
        employee: formData.employee,
        requestType: formData.requestType,
        leaveType: formData.leaveType,
        leaveDates: leaveDates,
        reason: formData.reason,
        status: formData.status || 'Pending'
      };

      // Add alternateDate if it's a Compensatory leave
      if (formData.requestType === 'Compensatory' && formData.alternateDate) {
        payload.alternateDate = new Date(formData.alternateDate).toISOString();
      }

      await axios.post('/admin/leaves', payload);
      setSnackbar({ open: true, message: 'Leave assigned successfully!', severity: 'success' });
      setShowAssignDialog(false);
      setAssignLeaveRequest(null);
      fetchAllData();
    } catch (error) {
      console.error('Error assigning leave:', error);
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Failed to assign leave', 
        severity: 'error' 
      });
    } finally {
      setIsAssigningLeave(false);
    }
  };
  
  const handleAllocateLeaves = async () => {
    try {
        await axios.post('/admin/leaves/allocate', {
            employeeId: allocateForm.employeeId,
            year: allocateForm.year,
            sickLeaveEntitlement: allocateForm.sickLeaveEntitlement,
            casualLeaveEntitlement: allocateForm.casualLeaveEntitlement,
            paidLeaveEntitlement: allocateForm.paidLeaveEntitlement,
        });
        setSnackbar({ open: true, message: 'Leave entitlements allocated successfully!', severity: 'success' });
        setShowAllocateDialog(false);
        fetchAllData();
    } catch (error) {
        console.error('Error allocating leaves:', error);
        setSnackbar({ open: true, message: error.response?.data?.error || 'Failed to allocate leaves', severity: 'error' });
    }
  };

  const handleBulkAllocateLeaves = async () => {
    if (!bulkAllocateForm.employeeIds || bulkAllocateForm.employeeIds.length === 0) {
        setSnackbar({ open: true, message: 'Please select at least one employee', severity: 'warning' });
        return;
    }
    
    try {
        const response = await axios.post('/admin/leaves/bulk-allocate', {
            employeeIds: bulkAllocateForm.employeeIds,
            year: bulkAllocateForm.year,
            sickLeaveEntitlement: bulkAllocateForm.sickLeaveEntitlement,
            casualLeaveEntitlement: bulkAllocateForm.casualLeaveEntitlement,
            paidLeaveEntitlement: bulkAllocateForm.paidLeaveEntitlement,
        });
        
        const { results } = response.data;
        const message = `Bulk allocation completed: ${results.successful.length} successful, ${results.failed.length} failed.`;
        setSnackbar({ open: true, message, severity: results.failed.length > 0 ? 'warning' : 'success' });
        setShowBulkAllocateDialog(false);
        setBulkAllocateForm({ ...bulkAllocateForm, employeeIds: [] });
        fetchAllData();
    } catch (error) {
        console.error('Error bulk allocating leaves:', error);
        setSnackbar({ open: true, message: error.response?.data?.error || 'Failed to bulk allocate leaves', severity: 'error' });
    }
  };

  const handleToggleEmployeeSelection = (employeeId) => {
    setBulkAllocateForm(prev => {
        const currentIds = prev.employeeIds || [];
        if (currentIds.includes(employeeId)) {
            return { ...prev, employeeIds: currentIds.filter(id => id !== employeeId) };
        } else {
            return { ...prev, employeeIds: [...currentIds, employeeId] };
        }
    });
  };

  const handleSelectAllEmployees = () => {
    const allEmployeeIds = employees.map(emp => emp._id);
    setBulkAllocateForm(prev => ({ ...prev, employeeIds: allEmployeeIds }));
  };

  const handleDeselectAllEmployees = () => {
    setBulkAllocateForm(prev => ({ ...prev, employeeIds: [] }));
  };


  const handleBack = () => navigate(-1);
  
  // FIXED: Fetch leave usage data - optimized to only fetch employee-specific data
  const fetchLeaveUsageForYear = useCallback(async (employeeId, year, employeeData) => {
    if (!employeeId || !year) return;
    
    setLoadingLeaveUsage(true);
    try {
      // Get previous year (year - 1) - this is what we're analyzing for year-end summary
      const previousYear = year - 1;
      
      // FIXED: Fetch employee-specific data only - no global fetching
      const [leaveRequestsResPrevious, leaveRequestsResCurrent, yearEndRes] = await Promise.all([
        axios.get(`/admin/leaves/employee/${employeeId}?year=${previousYear}`),
        axios.get(`/admin/leaves/employee/${employeeId}?year=${year}`),
        // FIXED: Fetch employee-specific year-end requests only
        axios.get(`/admin/leaves/year-end-requests?employeeId=${employeeId}&year=${previousYear}`)
      ]);

      const allLeaveRequestsPrevious = leaveRequestsResPrevious.data || [];
      const allLeaveRequestsCurrent = leaveRequestsResCurrent.data || [];
      
      // Filter out YEAR_END requests from normal leave requests
      const normalLeaveRequestsPrevious = allLeaveRequestsPrevious.filter(r => r.requestType !== 'YEAR_END');
      const normalLeaveRequestsCurrent = allLeaveRequestsCurrent.filter(r => r.requestType !== 'YEAR_END');
      
      // FIXED: Backend already filtered by employeeId - no client-side filtering needed
      const employeeYearEndRequests = yearEndRes.data.requests || yearEndRes.data || [];

      // Calculate utilized leaves by type for the PREVIOUS year
      const utilized = { sick: 0, casual: 0, paid: 0 };
      normalLeaveRequestsPrevious.forEach(leave => {
        if (leave.status === 'Approved') {
          const days = leave.leaveDates.length * (leave.leaveType?.startsWith('Half Day') ? 0.5 : 1);
          if (leave.requestType === 'Sick') utilized.sick += days;
          else if (leave.requestType === 'Planned' || leave.requestType === 'Casual') utilized.casual += days;
          else if (leave.requestType === 'Loss of Pay') utilized.paid += days; // Adjust based on your system
        }
      });
      
      // For previous year opening balance, we need to check what was allocated at the start of that year
      // This would typically be in leaveEntitlements, but we need historical data
      // For now, we'll use current entitlements as a proxy, but ideally this should come from historical records
      const previousYearOpening = {
        sick: employeeData?.leaveEntitlements?.sick ?? 12,
        casual: employeeData?.leaveEntitlements?.casual ?? 12,
        paid: employeeData?.leaveEntitlements?.paid ?? 0
      };

      // Group year-end requests by leave type
      const yearEndByType = {};
      employeeYearEndRequests.forEach(req => {
        const leaveType = req.yearEndLeaveType?.toLowerCase() || 'unknown';
        if (!yearEndByType[leaveType]) {
          yearEndByType[leaveType] = [];
        }
        yearEndByType[leaveType].push(req);
      });

      // Calculate remaining before year-end (opening - utilized)
      const remainingBeforeYearEnd = {
        sick: Math.max(0, previousYearOpening.sick - utilized.sick),
        casual: Math.max(0, previousYearOpening.casual - utilized.casual),
        paid: Math.max(0, previousYearOpening.paid - utilized.paid)
      };

      setLeaveUsageData({
        year, // Selected year (current year being viewed)
        previousYear, // The year we're analyzing (year - 1)
        previousYearOpening,
        utilized,
        remainingBeforeYearEnd,
        yearEndRequests: employeeYearEndRequests,
        yearEndByType,
        currentBalances: employeeData?.leaveBalances || {}, // Current year balances (resulting from previous year's year-end action)
        leaveRequests: normalLeaveRequestsCurrent // Store current year leave requests for KPI calculations
      });
    } catch (err) {
      console.error('Error fetching leave usage:', err);
      setLeaveUsageData(null);
    } finally {
      setLoadingLeaveUsage(false);
    }
  }, []);

  // Fetch Year-End history and leave usage when employee dialog opens
  useEffect(() => {
    if (showEmployeeDialog && dialogEmployee?._id) {
      setLoadingYearEndHistory(true);
      setLoadingLeaveUsage(true);
      
      // FIXED: Fetch employee-specific Year-End requests only
      axios.get(`/admin/leaves/year-end-requests?employeeId=${dialogEmployee._id}&limit=100`)
        .then(res => {
          // Backend already filtered by employeeId
          const employeeYearEndRequests = res.data.requests || [];
          setYearEndHistory(employeeYearEndRequests);
        })
        .catch(err => {
          console.error('Error fetching Year-End history:', err);
          setYearEndHistory([]);
        })
        .finally(() => {
          setLoadingYearEndHistory(false);
        });

      // Fetch leave usage for the selected year
      fetchLeaveUsageForYear(dialogEmployee._id, dialogSelectedYear, dialogEmployee);
    } else {
      setYearEndHistory([]);
      setLeaveUsageData(null);
    }
  }, [showEmployeeDialog, dialogEmployee, dialogSelectedYear, fetchLeaveUsageForYear]);

  const getProgressColor = (used, total) => {
    const percentage = total > 0 ? (used / total) * 100 : 0;
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><CircularProgress /></Box>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
        {/* UPGRADED: Clean header with better responsiveness */}
        <Paper elevation={0} sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Box sx={{ p: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <IconButton onClick={handleBack} size="small" sx={{ color: 'primary.main' }}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Employee Leaves Tracker
              </Typography>
            </Box>
            <Box display="flex" gap={1.5} flexWrap="wrap">
              <Button 
                variant="contained" 
                size="small"
                startIcon={<Add />} 
                onClick={() => { setAssignLeaveRequest(null); setShowAssignDialog(true); }}
                sx={{ textTransform: 'none' }}
              >
                Assign Leave
              </Button>
              <Button 
                variant="contained" 
                size="small"
                startIcon={<Assignment />} 
                onClick={() => setShowAllocateDialog(true)}
                color="info"
                sx={{ textTransform: 'none' }}
              >
                Allocate
              </Button>
              <Button 
                variant="contained" 
                size="small"
                startIcon={<Group />} 
                onClick={() => setShowBulkAllocateDialog(true)}
                color="secondary"
                sx={{ textTransform: 'none' }}
              >
                Bulk Allocate
              </Button>
            </Box>
          </Box>
        </Paper>
        
        {/* UPGRADED: Tabs with cleaner styling */}
        <Paper elevation={0} sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)} 
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 }
            }}
          >
            <Tab label="Leave Balances" />
            <Tab label="Leave Requests" />
            <Tab label="Saturday Schedule" />
          </Tabs>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* UPGRADED: Cleaner filters card */}
        <Paper elevation={0} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                fullWidth 
                label="Search employees..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Name or code..."
                InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} 
                size="small" 
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={selectedDepartment} label="Department" onChange={(e) => setSelectedDepartment(e.target.value)}>
                  <MenuItem value="">All Departments</MenuItem>
                  {departments.map((dept) => (<MenuItem key={dept} value={dept}>{dept}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Employee</InputLabel>
                <Select value={selectedEmployee} label="Employee" onChange={(e) => setSelectedEmployee(e.target.value)}>
                  <MenuItem value="">All Employees</MenuItem>
                  {employees.map((emp) => (<MenuItem key={emp._id} value={emp._id}>{emp.fullName} ({emp.employeeCode})</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Year</InputLabel>
                <Select value={selectedYear} label="Year" onChange={(e) => setSelectedYear(e.target.value)}>
                  {[2023, 2024, 2025, 2026].map((year) => (<MenuItem key={year} value={year}>{year}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
        
    {/* UPGRADED: Modern Leave Balances table with pagination */}
        {activeTab === 0 && (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Leave Balances Overview
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {filteredLeaveData.length} employee{filteredLeaveData.length !== 1 ? 's' : ''} found
                    </Typography>
                </Box>
                
                {loading ? (
                    <Box sx={{ p: 2 }}>
                        {[...Array(5)].map((_, index) => (
                            <Skeleton key={index} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
                        ))}
                    </Box>
                ) : filteredLeaveData.length === 0 ? (
                    <Box textAlign="center" py={8}>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No employees found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Try adjusting your search filters
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: { xs: '60vh', md: '70vh' } }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50', py: 1.5 }}>Employee</TableCell>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Department</TableCell>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Total (Used/Total)</TableCell>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Sick</TableCell>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Casual</TableCell>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Planned</TableCell>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>LOP</TableCell>
                                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedLeaveData.map((data) => {
                                        const { employee, balances } = data;
                                        const { totalUsed, totalEntitlement } = balances;
                                        const { used, entitlements } = balances;

                                        return (
                                            <TableRow 
                                                key={employee._id} 
                                                hover 
                                                sx={{ 
                                                    cursor: 'pointer',
                                                    '&:hover': { bgcolor: 'action.hover' },
                                                    '& td': { py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }
                                                }}
                                                onClick={() => {
                                                    setDialogEmployee(employee);
                                                    setSelectedRequest(null);
                                                    setShowEmployeeDialog(true);
                                                }}
                                            >
                                                <TableCell>
                                                    <Box display="flex" alignItems="center" gap={1.5}>
                                                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem', bgcolor: 'primary.main' }}>
                                                            {employee.fullName.charAt(0)}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={500}>
                                                                {employee.fullName}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {employee.employeeCode}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {employee.department || 'N/A'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ minWidth: 120 }}>
                                                        <Typography variant="body2" fontWeight={500} gutterBottom>
                                                            {totalUsed} / {totalEntitlement}
                                                        </Typography>
                                                        <LinearProgress 
                                                            variant="determinate" 
                                                            value={(totalUsed / totalEntitlement) * 100 || 0} 
                                                            color={getProgressColor(totalUsed, totalEntitlement)} 
                                                            sx={{ height: 6, borderRadius: 1 }} 
                                                        />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {((totalUsed / totalEntitlement) * 100 || 0).toFixed(0)}% used
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {used.sick} / {entitlements.sick}
                                                    </Typography>
                                                    <Typography variant="caption" color={balances.balances.sick > 0 ? 'success.main' : 'error.main'}>
                                                        Bal: {balances.balances.sick}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {used.casual} / {entitlements.casual}
                                                    </Typography>
                                                    <Typography variant="caption" color={balances.balances.casual > 0 ? 'success.main' : 'error.main'}>
                                                        Bal: {balances.balances.casual}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {used.paid} / {entitlements.paid}
                                                    </Typography>
                                                    <Typography variant="caption" color={balances.balances.paid > 0 ? 'success.main' : 'error.main'}>
                                                        Bal: {balances.balances.paid}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="warning.main">
                                                        {used.unpaid}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Box display="flex" gap={0.5} justifyContent="center">
                                                        <Tooltip title="Assign Leave">
                                                            <IconButton 
                                                                size="small" 
                                                                onClick={() => { 
                                                                    setAssignLeaveRequest({ employee: { _id: employee._id } }); 
                                                                    setShowAssignDialog(true); 
                                                                }}
                                                            >
                                                                <Add fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="View History">
                                                            <IconButton 
                                                                size="small" 
                                                                onClick={() => {
                                                                    setDialogEmployee(employee);
                                                                    setSelectedRequest(null);
                                                                    setShowEmployeeDialog(true);
                                                                }}
                                                            >
                                                                <History fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Allocate">
                                                            <IconButton 
                                                                size="small" 
                                                                onClick={() => { 
                                                                    setAllocateForm({ ...allocateForm, employeeId: employee._id }); 
                                                                    setShowAllocateDialog(true); 
                                                                }}
                                                            >
                                                                <Assignment fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        
                        {/* UPGRADED: Pagination controls */}
                        <TablePagination
                            component="div"
                            count={filteredLeaveData.length}
                            page={page}
                            onPageChange={(event, newPage) => setPage(newPage)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(event) => {
                                setRowsPerPage(parseInt(event.target.value, 10));
                                setPage(0);
                            }}
                            rowsPerPageOptions={[10, 15, 25, 50]}
                            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                        />
                    </>
                )}
            </Paper>
        )}
        {/* UPGRADED: Leave Requests Tab */}
        {activeTab === 1 && (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 2 }}>
                        Leave Requests
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Month</InputLabel>
                                <Select value={selectedMonth} label="Month" onChange={(e) => setSelectedMonth(e.target.value)}>
                                    <MenuItem value="">All Months</MenuItem>
                                    {[...Array(12)].map((_, i) => (
                                        <MenuItem key={i} value={i}>{new Date(0, i).toLocaleString(undefined, { month: 'long' })}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Week</InputLabel>
                                <Select value={selectedWeek} label="Week" onChange={(e) => setSelectedWeek(e.target.value)}>
                                    <MenuItem value="">All Weeks</MenuItem>
                                    {[1,2,3,4,5].map(w => (<MenuItem key={w} value={w}>{`Week ${w}`}</MenuItem>))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="caption" color="text.secondary">
                                Filters apply to first leave date. {filteredLeaveRequests.length} request{filteredLeaveRequests.length !== 1 ? 's' : ''} found.
                            </Typography>
                        </Grid>
                    </Grid>
                </Box>

                <TableContainer sx={{ maxHeight: { xs: '60vh', md: '70vh' } }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50', py: 1.5 }}>Employee</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Department</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Leave Type</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Dates</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Days</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Applied On</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredLeaveRequests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <Box textAlign="center" py={8}>
                                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                                No leave requests found
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Try adjusting your filters
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLeaveRequests.map(req => {
                                    const emp = req.employee || {};
                                    const dates = Array.isArray(req.leaveDates) ? req.leaveDates : [];
                                    const days = dates.length * (req.leaveType && req.leaveType.startsWith('Half Day') ? 0.5 : 1);
                                    const appliedOn = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : (dates[0] ? new Date(dates[0]).toLocaleDateString() : 'N/A');
                                    return (
                                        <TableRow 
                                            key={req._id} 
                                            hover 
                                            sx={{ 
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: 'action.hover' },
                                                '& td': { py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }
                                            }} 
                                            onClick={() => { setDialogEmployee(emp); setSelectedRequest(req); setShowEmployeeDialog(true); }}
                                        >
                                            <TableCell>
                                                <Box display="flex" alignItems="center" gap={1.5}>
                                                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem', bgcolor: 'primary.main' }}>
                                                        {(emp.fullName || '').charAt(0)}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={500}>
                                                            {emp.fullName || 'Unknown'}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {emp.employeeCode || ''}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {emp.department || 'N/A'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {formatLeaveRequestType(req.requestType) || 'N/A'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {req.leaveType || 'N/A'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {dates.slice(0, 2).map(d => (new Date(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ')}
                                                    {dates.length > 2 && ` +${dates.length - 2}`}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={500}>
                                                    {days}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={req.status || 'Pending'} 
                                                    color={req.status === 'Approved' ? 'success' : req.status === 'Rejected' ? 'error' : 'warning'} 
                                                    size="small" 
                                                    sx={{ fontWeight: 500, height: 24 }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {appliedOn}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        )}

        {activeTab === 2 && (
            <SaturdayScheduleManager employees={employees} onUpdate={fetchAllData} />
        )}
        
        {/* PART 2 FIX: Redesigned Employee Leave History Modal */}
        <Dialog
            open={showEmployeeDialog}
            onClose={() => {
                setShowEmployeeDialog(false);
                setYearEndHistory([]);
                setLeaveUsageData(null);
                setDialogSelectedYear(new Date().getFullYear());
            }}
            maxWidth="xl"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: '#fafafa',
                    borderRadius: 2,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    maxHeight: '90vh',
                }
            }}
        >
            {/* REDESIGNED: Cleaner sticky header */}
            <DialogTitle 
                sx={{ 
                    bgcolor: 'white',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    px: 3,
                    py: 2
                }}
            >
                <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                            Employee Leave History
                        </Typography>
                        {dialogEmployee && (
                            <Box display="flex" alignItems="center" gap={1.5} mt={1}>
                                <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                                    {(dialogEmployee.fullName || '').charAt(0)}
                                </Avatar>
                                <Box>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {dialogEmployee.fullName || 'Unknown'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {dialogEmployee.employeeCode || 'N/A'} • {dialogEmployee.department || 'N/A'}
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </Box>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel>Year</InputLabel>
                        <Select
                            value={dialogSelectedYear}
                            label="Year"
                            onChange={(e) => {
                                const newYear = e.target.value;
                                setDialogSelectedYear(newYear);
                                if (dialogEmployee?._id) {
                                    fetchLeaveUsageForYear(dialogEmployee._id, newYear, dialogEmployee);
                                }
                            }}
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                <MenuItem key={year} value={year}>{year}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ px: 3, py: 3, bgcolor: '#fafafa' }}>
                {dialogEmployee ? (
                    <Box>

                        {loadingLeaveUsage || loadingYearEndHistory ? (
                            <Box display="flex" flexDirection="column" alignItems="center" py={6}>
                                <CircularProgress />
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                    Loading leave data...
                                </Typography>
                            </Box>
                        ) : !leaveUsageData ? (
                            <Alert severity="info" variant="outlined">
                                Unable to load leave usage data.
                            </Alert>
                        ) : (
                            <>
                                {/* Calculate totals across all leave types */}
                                {(() => {
                                    const totalOpening = Object.values(leaveUsageData.previousYearOpening).reduce((sum, val) => sum + (val || 0), 0);
                                    const totalUtilized = Object.values(leaveUsageData.utilized).reduce((sum, val) => sum + (val || 0), 0);
                                    const totalRemaining = Object.values(leaveUsageData.remainingBeforeYearEnd).reduce((sum, val) => sum + (val || 0), 0);
                                    
                                    // Find the primary year-end action (prefer approved, then pending, then rejected)
                                    const allYearEndRequests = leaveUsageData.yearEndRequests || [];
                                    const approvedAction = allYearEndRequests.find(r => r.status === 'Approved');
                                    const pendingAction = allYearEndRequests.find(r => r.status === 'Pending');
                                    const rejectedAction = allYearEndRequests.find(r => r.status === 'Rejected');
                                    const primaryYearEndAction = approvedAction || pendingAction || rejectedAction || null;
                                    
                                    // Calculate total current balance
                                    const totalCurrentBalance = Object.values(leaveUsageData.currentBalances).reduce((sum, val) => sum + (val || 0), 0);
                                    
                                    return (
                                        <>
                                            {/* REDESIGNED: Clean Leave Summary Cards */}
                                            <Paper 
                                                elevation={0} 
                                                sx={{ 
                                                    p: 3, 
                                                    mb: 2, 
                                                    bgcolor: 'white', 
                                                    borderRadius: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider'
                                                }}
                                            >
                                                <Typography 
                                                    variant="subtitle1" 
                                                    sx={{ 
                                                        mb: 2.5, 
                                                        fontWeight: 600,
                                                        color: 'text.primary'
                                                    }}
                                                >
                                                    Leave Summary ({leaveUsageData.previousYear} → {leaveUsageData.year})
                                                </Typography>
                                                
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} sm={4}>
                                                        <Paper 
                                                            elevation={0}
                                                            sx={{ 
                                                                p: 2.5, 
                                                                textAlign: 'center',
                                                                bgcolor: '#f8f9fa',
                                                                borderRadius: 1.5,
                                                                border: '1px solid',
                                                                borderColor: 'divider'
                                                            }}
                                                        >
                                                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                                                Previous Year Opening Balance
                                                            </Typography>
                                                            <Typography 
                                                                variant="h4" 
                                                                sx={{ 
                                                                    fontWeight: 600, 
                                                                    color: 'text.primary'
                                                                }}
                                                            >
                                                                {totalOpening.toFixed(1)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                DAYS
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>
                                                    <Grid item xs={12} sm={4}>
                                                        <Paper 
                                                            elevation={0}
                                                            sx={{ 
                                                                p: 2.5, 
                                                                textAlign: 'center',
                                                                bgcolor: '#f8f9fa',
                                                                borderRadius: 1.5,
                                                                border: '1px solid',
                                                                borderColor: 'divider'
                                                            }}
                                                        >
                                                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                                                Leaves Used During Year
                                                            </Typography>
                                                            <Typography 
                                                                variant="h4" 
                                                                sx={{ 
                                                                    fontWeight: 600, 
                                                                    color: 'text.primary'
                                                                }}
                                                            >
                                                                {totalUtilized.toFixed(1)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                DAYS
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>
                                                    <Grid item xs={12} sm={4}>
                                                        <Paper 
                                                            elevation={0}
                                                            sx={{ 
                                                                p: 2.5, 
                                                                textAlign: 'center',
                                                                bgcolor: '#f8f9fa',
                                                                borderRadius: 1.5,
                                                                border: '1px solid',
                                                                borderColor: 'divider'
                                                            }}
                                                        >
                                                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                                                Remaining at Year End
                                                            </Typography>
                                                            <Typography 
                                                                variant="h4" 
                                                                sx={{ 
                                                                    fontWeight: 600, 
                                                                    color: 'text.primary'
                                                                }}
                                                            >
                                                                {totalRemaining.toFixed(1)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                DAYS
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>
                                                </Grid>
                                            </Paper>

                                            {/* REDESIGNED: Year-End Action Section */}
                                            <Paper 
                                                elevation={0} 
                                                sx={{ 
                                                    p: 2.5, 
                                                    mb: 2, 
                                                    bgcolor: 'white',
                                                    borderRadius: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider'
                                                }}
                                            >
                                                <Typography 
                                                    variant="subtitle1" 
                                                    sx={{ 
                                                        mb: 2, 
                                                        fontWeight: 600,
                                                        color: 'text.primary'
                                                    }}
                                                >
                                                    Year-End Action Taken
                                                </Typography>
                                                
                                                {primaryYearEndAction ? (
                                                    <Box>
                                                        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                                            {primaryYearEndAction.yearEndSubType === 'CARRY_FORWARD' ? (
                                                                <>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <ArrowUpward color="primary" />
                                                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                                            Carry Forward:
                                                                        </Typography>
                                                                    </Box>
                                                                    <Typography 
                                                                        variant="h5" 
                                                                        sx={{ 
                                                                            fontWeight: 600, 
                                                                            color: 'primary.main'
                                                                        }}
                                                                    >
                                                                        {primaryYearEndAction.yearEndDays || 0} days
                                                                    </Typography>
                                                                    {primaryYearEndAction.yearEndLeaveType && (
                                                                        <Chip 
                                                                            label={primaryYearEndAction.yearEndLeaveType} 
                                                                            size="small" 
                                                                            variant="outlined"
                                                                            color="primary"
                                                                        />
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <AttachMoney color="success" />
                                                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                                            Encashed:
                                                                        </Typography>
                                                                    </Box>
                                                                    <Typography 
                                                                        variant="h5" 
                                                                        sx={{ 
                                                                            fontWeight: 600, 
                                                                            color: 'success.main'
                                                                        }}
                                                                    >
                                                                        {primaryYearEndAction.yearEndDays || 0} days
                                                                    </Typography>
                                                                    {primaryYearEndAction.yearEndLeaveType && (
                                                                        <Chip 
                                                                            label={primaryYearEndAction.yearEndLeaveType} 
                                                                            size="small" 
                                                                            variant="outlined"
                                                                            color="success"
                                                                        />
                                                                    )}
                                                                </>
                                                            )}
                                                        </Box>
                                                        
                                                        <Divider sx={{ my: 2 }} />
                                                        <Grid container spacing={2}>
                                                            <Grid item xs={12} sm={6}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    {primaryYearEndAction.status === 'Approved' && <CheckCircle color="success" fontSize="small" />}
                                                                    {primaryYearEndAction.status === 'Rejected' && <Cancel color="error" fontSize="small" />}
                                                                    {primaryYearEndAction.status === 'Pending' && <Pending color="warning" fontSize="small" />}
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Status:
                                                                    </Typography>
                                                                    <Chip
                                                                        label={primaryYearEndAction.status}
                                                                        size="small"
                                                                        color={
                                                                            primaryYearEndAction.status === 'Approved' ? 'success' :
                                                                            primaryYearEndAction.status === 'Rejected' ? 'error' :
                                                                            'warning'
                                                                        }
                                                                        variant="outlined"
                                                                    />
                                                                </Box>
                                                            </Grid>
                                                            {primaryYearEndAction.approvedBy && (
                                                                <Grid item xs={12} sm={6}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Approved By: <strong>{primaryYearEndAction.approvedBy?.fullName || 'N/A'}</strong>
                                                                    </Typography>
                                                                </Grid>
                                                            )}
                                                            {primaryYearEndAction.approvedAt && (
                                                                <Grid item xs={12} sm={6}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Approval Date: <strong>{new Date(primaryYearEndAction.approvedAt).toLocaleDateString()}</strong>
                                                                    </Typography>
                                                                </Grid>
                                                            )}
                                                            {primaryYearEndAction.status === 'Rejected' && (
                                                                <Grid item xs={12}>
                                                                    <Alert severity="error" variant="outlined" sx={{ mt: 1 }}>
                                                                        Year-End request rejected — no change in balance
                                                                    </Alert>
                                                                </Grid>
                                                            )}
                                                        </Grid>
                                                    </Box>
                                                ) : totalRemaining <= 0 ? (
                                                    <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                        No leaves available to carry forward or encash
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                        No Year-End Action Taken
                                                    </Typography>
                                                )}
                                            </Paper>

                                            {/* REDESIGNED: Current Year Leave Availability */}
                                            <Paper 
                                                elevation={0} 
                                                sx={{ 
                                                    p: 3, 
                                                    mb: 2, 
                                                    bgcolor: 'primary.50',
                                                    borderRadius: 2,
                                                    border: '1px solid',
                                                    borderColor: 'primary.main'
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                    <CalendarToday color="primary" fontSize="small" />
                                                    <Typography 
                                                        variant="subtitle1" 
                                                        sx={{ 
                                                            fontWeight: 600,
                                                            color: 'primary.main'
                                                        }}
                                                    >
                                                        Leaves Available from 1st January {leaveUsageData.year}
                                                    </Typography>
                                                </Box>
                                                
                                                <Box sx={{ textAlign: 'center', py: 1 }}>
                                                    <Typography 
                                                        variant="h3" 
                                                        sx={{ 
                                                            fontWeight: 600, 
                                                            color: 'primary.main',
                                                            mb: 0.5
                                                        }}
                                                    >
                                                        {totalCurrentBalance.toFixed(1)} <Typography component="span" variant="body1">days</Typography>
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Opening Balance (after carry forward / encash)
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                        Effective From: 01 January {leaveUsageData.year}
                                                    </Typography>
                                                </Box>
                                            </Paper>

                                            {/* KPI CARDS SECTION */}
                                            {(() => {
                                                // Calculate KPIs from approved leave requests for the analyzed year
                                                const approvedLeaves = (leaveUsageData.leaveRequests || []).filter(r => r.status === 'Approved');
                                                
                                                // Calculate totals
                                                let totalDaysTaken = 0;
                                                let fullDayCount = 0;
                                                let halfDayCount = 0;
                                                let halfDayFirstHalf = 0;
                                                let halfDaySecondHalf = 0;
                                                const leaveTypesUsed = { sick: 0, casual: 0, planned: 0, unpaid: 0 };
                                                
                                                approvedLeaves.forEach(leave => {
                                                    const isHalfDay = leave.leaveType?.startsWith('Half Day') || false;
                                                    const leaveCount = leave.leaveDates?.length || 0;
                                                    const daysValue = isHalfDay ? leaveCount * 0.5 : leaveCount;
                                                    
                                                    totalDaysTaken += daysValue;
                                                    
                                                    if (isHalfDay) {
                                                        halfDayCount += leaveCount;
                                                        if (leave.leaveType === 'Half Day - First Half') {
                                                            halfDayFirstHalf += leaveCount;
                                                        } else if (leave.leaveType === 'Half Day - Second Half') {
                                                            halfDaySecondHalf += leaveCount;
                                                        }
                                                    } else {
                                                        fullDayCount += leaveCount;
                                                    }
                                                    
                                                    // Count by request type
                                                    if (leave.requestType === 'Sick') leaveTypesUsed.sick += daysValue;
                                                    else if (leave.requestType === 'Planned') leaveTypesUsed.planned += daysValue;
                                                    else if (leave.requestType === 'Casual') leaveTypesUsed.casual += daysValue;
                                                    else if (leave.requestType === 'Loss of Pay') leaveTypesUsed.unpaid += daysValue;
                                                });
                                                
                                                // Find most used leave type
                                                const mostUsedType = Object.entries(leaveTypesUsed)
                                                    .filter(([_, count]) => count > 0)
                                                    .sort(([_, a], [__, b]) => b - a)[0];
                                                const mostUsedTypeName = mostUsedType 
                                                    ? mostUsedType[0].charAt(0).toUpperCase() + mostUsedType[0].slice(1) 
                                                    : 'None';
                                                
                                                // Determine half-day pattern
                                                const halfDayPattern = halfDayFirstHalf > halfDaySecondHalf 
                                                    ? 'First Half' 
                                                    : halfDaySecondHalf > halfDayFirstHalf 
                                                        ? 'Second Half' 
                                                        : halfDayCount > 0 ? 'Mixed' : 'None';
                                                
                                                return (
                                                    <>
                                                        <Paper elevation={2} sx={{ p: 2, mb: 3, bgcolor: '#FFFFFF', borderRadius: 2, border: '1px solid #E0E0E0' }}>
                                                            <Typography variant="h6" sx={{ mb: 2, color: '#000000', fontWeight: 600, borderLeft: '4px solid #D32F2F', pl: 1.5 }}>
                                                                Leave Usage KPIs ({leaveUsageData.year})
                                                            </Typography>
                                                            <Grid container spacing={2}>
                                                                {/* KPI 1: Total Leaves Taken */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Paper 
                                                                        elevation={1} 
                                                                        sx={{ 
                                                                            p: 2, 
                                                                            textAlign: 'center', 
                                                                            bgcolor: '#FFFFFF', 
                                                                            borderRadius: 1, 
                                                                            border: '1px solid #000000',
                                                                            minHeight: '120px',
                                                                            maxHeight: '120px',
                                                                            height: '120px',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'space-between',
                                                                            width: '100%'
                                                                        }}
                                                                    >
                                                                        <Typography 
                                                                            variant="caption" 
                                                                            display="block" 
                                                                            sx={{ 
                                                                                mb: 1, 
                                                                                color: '#000000',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                whiteSpace: 'nowrap'
                                                                            }}
                                                                        >
                                                                            Total Leaves Taken
                                                                        </Typography>
                                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#000000', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            {totalDaysTaken.toFixed(1)}
                                                                        </Typography>
                                                                        <Typography variant="caption" sx={{ color: '#000000', mt: 'auto' }}>
                                                                            Days
                                                                        </Typography>
                                                                    </Paper>
                                                                </Grid>
                                                                
                                                                {/* KPI 2: Full-Day Leaves */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Paper 
                                                                        elevation={1} 
                                                                        sx={{ 
                                                                            p: 2, 
                                                                            textAlign: 'center', 
                                                                            bgcolor: '#FFFFFF', 
                                                                            borderRadius: 1, 
                                                                            border: '1px solid #000000',
                                                                            minHeight: '120px',
                                                                            maxHeight: '120px',
                                                                            height: '120px',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'space-between',
                                                                            width: '100%'
                                                                        }}
                                                                    >
                                                                        <Typography 
                                                                            variant="caption" 
                                                                            display="block" 
                                                                            sx={{ 
                                                                                mb: 1, 
                                                                                color: '#000000',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                whiteSpace: 'nowrap'
                                                                            }}
                                                                        >
                                                                            Full-Day Leaves
                                                                        </Typography>
                                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#000000', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            {fullDayCount}
                                                                        </Typography>
                                                                        <Typography variant="caption" sx={{ color: '#000000', mt: 'auto' }}>
                                                                            Days
                                                                        </Typography>
                                                                    </Paper>
                                                                </Grid>
                                                                
                                                                {/* KPI 3: Half-Day Leaves */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Paper 
                                                                        elevation={1} 
                                                                        sx={{ 
                                                                            p: 2, 
                                                                            textAlign: 'center', 
                                                                            bgcolor: '#FFFFFF', 
                                                                            borderRadius: 1, 
                                                                            border: '1px solid #000000',
                                                                            minHeight: '120px',
                                                                            maxHeight: '120px',
                                                                            height: '120px',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'space-between',
                                                                            width: '100%'
                                                                        }}
                                                                    >
                                                                        <Typography 
                                                                            variant="caption" 
                                                                            display="block" 
                                                                            sx={{ 
                                                                                mb: 1, 
                                                                                color: '#000000',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                whiteSpace: 'nowrap'
                                                                            }}
                                                                        >
                                                                            Half-Day Leaves
                                                                        </Typography>
                                                                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                                                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#000000' }}>
                                                                                {halfDayCount}
                                                                            </Typography>
                                                                            <Typography variant="caption" sx={{ color: '#000000', mt: 0.5 }}>
                                                                                Half-Days
                                                                            </Typography>
                                                                            {halfDayCount > 0 && (
                                                                                <Typography variant="caption" sx={{ mt: 0.25, color: '#000000', fontSize: '0.65rem' }}>
                                                                                    ({halfDayCount * 0.5} Full Days)
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    </Paper>
                                                                </Grid>
                                                                
                                                                {/* KPI 4: Leave Types Used */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Paper 
                                                                        elevation={1} 
                                                                        sx={{ 
                                                                            p: 2, 
                                                                            textAlign: 'center', 
                                                                            bgcolor: '#FFFFFF', 
                                                                            borderRadius: 1, 
                                                                            border: '1px solid #000000',
                                                                            minHeight: '120px',
                                                                            maxHeight: '120px',
                                                                            height: '120px',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            justifyContent: 'space-between',
                                                                            width: '100%'
                                                                        }}
                                                                    >
                                                                        <Typography 
                                                                            variant="caption" 
                                                                            display="block" 
                                                                            sx={{ 
                                                                                mb: 1, 
                                                                                color: '#000000',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                whiteSpace: 'nowrap'
                                                                            }}
                                                                        >
                                                                            Leave Types Used
                                                                        </Typography>
                                                                        <Box sx={{ 
                                                                            flex: 1, 
                                                                            display: 'flex', 
                                                                            flexDirection: 'column', 
                                                                            justifyContent: 'center',
                                                                            alignItems: 'center',
                                                                            textAlign: 'left',
                                                                            width: '100%',
                                                                            overflow: 'hidden'
                                                                        }}>
                                                                            {leaveTypesUsed.sick > 0 && (
                                                                                <Typography variant="body2" sx={{ mb: 0.25, color: '#000000', fontSize: '0.75rem' }}>
                                                                                    <strong>Sick:</strong> {leaveTypesUsed.sick.toFixed(1)}
                                                                                </Typography>
                                                                            )}
                                                                            {leaveTypesUsed.casual > 0 && (
                                                                                <Typography variant="body2" sx={{ mb: 0.25, color: '#000000', fontSize: '0.75rem' }}>
                                                                                    <strong>Casual:</strong> {leaveTypesUsed.casual.toFixed(1)}
                                                                                </Typography>
                                                                            )}
                                                                            {leaveTypesUsed.planned > 0 && (
                                                                                <Typography variant="body2" sx={{ mb: 0.25, color: '#000000', fontSize: '0.75rem' }}>
                                                                                    <strong>Planned:</strong> {leaveTypesUsed.planned.toFixed(1)}
                                                                                </Typography>
                                                                            )}
                                                                            {leaveTypesUsed.unpaid > 0 && (
                                                                                <Typography variant="body2" sx={{ color: '#000000', fontSize: '0.75rem' }}>
                                                                                    <strong>Loss of Pay:</strong> {leaveTypesUsed.unpaid.toFixed(1)}
                                                                                </Typography>
                                                                            )}
                                                                            {totalDaysTaken === 0 && (
                                                                                <Typography variant="body2" sx={{ color: '#000000', fontSize: '0.75rem' }}>
                                                                                    No leaves taken
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    </Paper>
                                                                </Grid>
                                                            </Grid>
                                                        </Paper>

                                                        {/* LEAVE USAGE SUMMARY - PLAIN LANGUAGE */}
                                                        {totalDaysTaken > 0 && (
                                                            <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: '#FFFFFF', borderRadius: 2, border: '1px solid #E0E0E0' }}>
                                                                <Typography variant="h6" sx={{ mb: 2, color: '#000000', fontWeight: 600, borderLeft: '4px solid #D32F2F', pl: 1.5 }}>
                                                                    LEAVE USAGE SUMMARY
                                                                </Typography>
                                                                <Box sx={{ pl: 1 }}>
                                                                    <Typography variant="body1" sx={{ mb: 1.5, color: '#000000' }}>
                                                                        Employee took <strong>{fullDayCount} full-day leave{fullDayCount !== 1 ? 's' : ''}</strong>
                                                                        {halfDayCount > 0 && (
                                                                            <> and <strong>{halfDayCount} half-day leave{halfDayCount !== 1 ? 's' : ''}</strong></>
                                                                        )}
                                                                        {' '}in {leaveUsageData.year}.
                                                                    </Typography>
                                                                    {mostUsedType && mostUsedType[1] > 0 && (
                                                                        <Typography variant="body1" sx={{ mb: 1.5, color: '#000000' }}>
                                                                            Most used leave type: <strong>{mostUsedTypeName} Leave</strong> ({mostUsedType[1].toFixed(1)} days).
                                                                        </Typography>
                                                                    )}
                                                                    {halfDayCount > 0 && (
                                                                        <Typography variant="body1" sx={{ color: '#000000' }}>
                                                                            Half-day leaves mostly taken in <strong>{halfDayPattern}</strong>
                                                                            {halfDayPattern !== 'Mixed' && halfDayPattern !== 'None' && ' of the day'}.
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            </Paper>
                                                        )}
                                                    </>
                                                );
                                            })()}

                                            {/* DETAILED BREAKDOWN - COLLAPSIBLE */}
                                            <Accordion sx={{ mb: 2, border: '1px solid #E0E0E0' }}>
                                                <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#000000' }} />}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000000' }}>
                                                        View Detailed Breakdown by Leave Type
                                                    </Typography>
                                                </AccordionSummary>
                                                <AccordionDetails>
                                                    <Box>
                                                        {/* Summary by Leave Type */}
                                                        {['Sick', 'Casual', 'Paid'].map((leaveType) => {
                                                            const typeKey = leaveType.toLowerCase();
                                                            const opening = leaveUsageData.previousYearOpening[typeKey] || 0;
                                                            const utilized = leaveUsageData.utilized[typeKey] || 0;
                                                            const remaining = leaveUsageData.remainingBeforeYearEnd[typeKey] || 0;
                                                            const yearEndRequests = leaveUsageData.yearEndByType[typeKey] || [];
                                                            const currentBalance = leaveUsageData.currentBalances[typeKey] || 0;
                                                            
                                                            const approvedYearEnd = yearEndRequests.find(r => r.status === 'Approved');
                                                            const pendingYearEnd = yearEndRequests.find(r => r.status === 'Pending');
                                                            const rejectedYearEnd = yearEndRequests.find(r => r.status === 'Rejected');
                                                            const yearEndAction = approvedYearEnd || pendingYearEnd || rejectedYearEnd || null;
                                                            
                                                            return (
                                                                <Box key={leaveType} sx={{ mb: 3, p: 2, bgcolor: '#FFFFFF', borderRadius: 1, border: '1px solid #E0E0E0' }}>
                                                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#000000' }}>
                                                                        {leaveType} Leave
                                                                    </Typography>
                                                                    <Grid container spacing={2}>
                                                                        <Grid item xs={12} sm={6} md={3}>
                                                                            <Typography variant="body2" sx={{ color: '#000000' }}>Allocated Last Year</Typography>
                                                                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#000000' }}>{opening}</Typography>
                                                                        </Grid>
                                                                        <Grid item xs={12} sm={6} md={3}>
                                                                            <Typography variant="body2" sx={{ color: '#000000' }}>Used</Typography>
                                                                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#000000' }}>{utilized.toFixed(1)}</Typography>
                                                                        </Grid>
                                                                        <Grid item xs={12} sm={6} md={3}>
                                                                            <Typography variant="body2" sx={{ color: '#000000' }}>Remaining</Typography>
                                                                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#000000' }}>{remaining.toFixed(1)}</Typography>
                                                                        </Grid>
                                                                        <Grid item xs={12} sm={6} md={3}>
                                                                            <Typography variant="body2" sx={{ color: '#000000' }}>Current Balance</Typography>
                                                                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#000000' }}>{currentBalance.toFixed(1)}</Typography>
                                                                        </Grid>
                                                                        {yearEndAction && (
                                                                            <>
                                                                                {yearEndAction.yearEndSubType === 'CARRY_FORWARD' && (
                                                                                    <Grid item xs={12} sm={6}>
                                                                                        <Typography variant="body2" sx={{ color: '#000000' }}>Carried Forward</Typography>
                                                                                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#000000' }}>{yearEndAction.yearEndDays || 0} days</Typography>
                                                                                    </Grid>
                                                                                )}
                                                                                {yearEndAction.yearEndSubType === 'ENCASH' && (
                                                                                    <Grid item xs={12} sm={6}>
                                                                                        <Typography variant="body2" sx={{ color: '#000000' }}>Encashed</Typography>
                                                                                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#000000' }}>{yearEndAction.yearEndDays || 0} days</Typography>
                                                                                    </Grid>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </Grid>
                                                                </Box>
                                                            );
                                                        })}
                                                        
                                                        <Divider sx={{ my: 3, borderColor: '#E0E0E0' }} />
                                                        
                                                        {/* Detailed Leave Records with Half-Day Intelligence */}
                                                        <Box>
                                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#000000' }}>
                                                                Detailed Leave Records ({leaveUsageData.year})
                                                            </Typography>
                                                            {(() => {
                                                                const approvedLeaves = (leaveUsageData.leaveRequests || []).filter(r => r.status === 'Approved');
                                                                
                                                                if (approvedLeaves.length === 0) {
                                                                    return (
                                                                        <Alert sx={{ bgcolor: '#FFFFFF', color: '#000000', border: '1px solid #E0E0E0' }}>
                                                                            No approved leave records found for {leaveUsageData.year}.
                                                                        </Alert>
                                                                    );
                                                                }
                                                                
                                                                return (
                                                                    <TableContainer component={Paper} elevation={1} sx={{ border: '1px solid #E0E0E0' }}>
                                                                        <Table size="small">
                                                                            <TableHead>
                                                                                <TableRow sx={{ bgcolor: '#FFFFFF', borderBottom: '2px solid #000000' }}>
                                                                                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Leave Type</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Day Type</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Half Type</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Date(s)</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }} align="right">Days</TableCell>
                                                                                </TableRow>
                                                                            </TableHead>
                                                                            <TableBody>
                                                                                {approvedLeaves.map((leave, idx) => {
                                                                                    const isHalfDay = leave.leaveType?.startsWith('Half Day') || false;
                                                                                    const halfType = isHalfDay 
                                                                                        ? (leave.leaveType === 'Half Day - First Half' ? 'First Half' : 'Second Half')
                                                                                        : '-';
                                                                                    const dayType = isHalfDay ? 'Half Day' : 'Full Day';
                                                                                    const leaveCount = leave.leaveDates?.length || 0;
                                                                                    const daysValue = isHalfDay ? leaveCount * 0.5 : leaveCount;
                                                                                    const requestTypeName = leave.requestType === 'Sick' ? 'Sick' 
                                                                                        : leave.requestType === 'Planned' ? 'Planned'
                                                                                        : leave.requestType === 'Casual' ? 'Casual'
                                                                                        : leave.requestType === 'Loss of Pay' ? 'Loss of Pay'
                                                                                        : leave.requestType || 'N/A';
                                                                                    
                                                                                    return (
                                                                                        <TableRow 
                                                                                            key={leave._id || idx} 
                                                                                            sx={{ 
                                                                                                bgcolor: '#FFFFFF',
                                                                                                '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.05)' }
                                                                                            }}
                                                                                        >
                                                                                            <TableCell sx={{ color: '#000000' }}>{requestTypeName}</TableCell>
                                                                                            <TableCell>
                                                                                                <Chip 
                                                                                                    label={dayType} 
                                                                                                    size="small" 
                                                                                                    sx={{
                                                                                                        bgcolor: '#FFFFFF',
                                                                                                        color: '#000000',
                                                                                                        border: '1px solid #000000'
                                                                                                    }}
                                                                                                />
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                {isHalfDay ? (
                                                                                                    <Chip 
                                                                                                        label={halfType} 
                                                                                                        size="small" 
                                                                                                        variant="outlined"
                                                                                                        sx={{
                                                                                                            bgcolor: '#FFFFFF',
                                                                                                            color: '#000000',
                                                                                                            border: '1px solid #E0E0E0'
                                                                                                        }}
                                                                                                    />
                                                                                                ) : (
                                                                                                    <Typography variant="body2" sx={{ color: '#000000' }}>-</Typography>
                                                                                                )}
                                                                                            </TableCell>
                                                                                            <TableCell sx={{ color: '#000000' }}>
                                                                                                {leave.leaveDates && leave.leaveDates.length > 0 ? (
                                                                                                    leave.leaveDates.map((date, i) => (
                                                                                                        <Typography key={i} variant="body2" component="span" sx={{ color: '#000000' }}>
                                                                                                            {new Date(date).toLocaleDateString()}
                                                                                                            {i < leave.leaveDates.length - 1 && ', '}
                                                                                                        </Typography>
                                                                                                    ))
                                                                                                ) : (
                                                                                                    <Typography variant="body2" sx={{ color: '#000000' }}>N/A</Typography>
                                                                                                )}
                                                                                            </TableCell>
                                                                                            <TableCell align="right">
                                                                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#000000' }}>
                                                                                                    {daysValue.toFixed(1)}
                                                                                                </Typography>
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    );
                                                                                })}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </TableContainer>
                                                                );
                                                            })()}
                                                        </Box>
                                                    </Box>
                                                </AccordionDetails>
                                            </Accordion>
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </Box>
                ) : (
                    <Alert severity="warning" variant="outlined">
                        No employee data available.
                    </Alert>
                )}
            </DialogContent>
            {/* REDESIGNED: Clean sticky footer */}
            <DialogActions 
                sx={{ 
                    px: 3, 
                    py: 2, 
                    bgcolor: 'white',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 1
                }}
            >
                <Button
                    onClick={() => {
                        setShowEmployeeDialog(false);
                        setYearEndHistory([]);
                        setLeaveUsageData(null);
                        setDialogSelectedYear(new Date().getFullYear());
                    }}
                    variant="contained"
                    color="primary"
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>

        <Dialog 
            open={showAllocateDialog} 
            onClose={() => setShowAllocateDialog(false)} 
            maxWidth="lg" 
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    minHeight: '700px',
                    backgroundColor: '#fafafa'
                }
            }}
        >
            {/* Header - Clean & Professional */}
            <DialogTitle sx={{ 
                backgroundColor: '#ffffff',
                color: '#1a1a1a', 
                fontWeight: 600,
                fontSize: '1.5rem',
                py: 3,
                px: 4,
                borderBottom: '2px solid #e5e7eb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Assignment sx={{ color: '#dc3545', fontSize: '1.75rem' }} />
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            color: '#1a1a1a',
                            fontWeight: 600,
                            fontSize: '1.5rem'
                        }}
                    >
                        Allocate Leave Entitlements
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ 
                backgroundColor: '#fafafa',
                p: 4,
                '&.MuiDialogContent-root': {
                    paddingTop: '32px'
                }
            }}>
                <Stack spacing={4}>
                    {/* STEP 1: Employee Selection Section */}
                    <Card sx={{ 
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        border: '1px solid #e5e7eb'
                    }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ 
                                mb: 3, 
                                color: '#1a1a1a', 
                                fontWeight: 600,
                                fontSize: '1.125rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                <Box sx={{ 
                                    backgroundColor: '#dc3545', 
                                    color: 'white', 
                                    borderRadius: '50%', 
                                    width: 24, 
                                    height: 24, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold'
                                }}>
                                    1
                                </Box>
                                Employee Selection
                            </Typography>
                            
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        options={employees}
                                        getOptionLabel={(option) => `${option.fullName} (${option.employeeCode})`}
                                        value={employees.find(emp => emp._id === allocateForm.employeeId) || null}
                                        onChange={(event, newValue) => {
                                            setAllocateForm({ ...allocateForm, employeeId: newValue?._id || '' });
                                        }}
                                        renderOption={(props, option) => (
                                            <Box component="li" {...props} sx={{ p: 2 }}>
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                        {option.fullName}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                                        ID: {option.employeeCode} • {option.department || 'No Department'} • {option.employmentType || 'Permanent'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Select Employee"
                                                placeholder="Search by name or employee ID..."
                                                required
                                                helperText={!allocateForm.employeeId ? "Please select an employee to continue" : ""}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '8px',
                                                        backgroundColor: '#ffffff',
                                                        '& fieldset': {
                                                            borderColor: allocateForm.employeeId ? '#10b981' : '#d1d5db',
                                                            borderWidth: allocateForm.employeeId ? '2px' : '1px'
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: '#dc3545'
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#dc3545',
                                                            borderWidth: '2px'
                                                        }
                                                    },
                                                    '& .MuiInputLabel-root.Mui-focused': {
                                                        color: '#dc3545'
                                                    }
                                                }}
                                            />
                                        )}
                                        noOptionsText="No employees found"
                                        sx={{ width: '100%' }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth>
                                        <InputLabel 
                                            id="year-label"
                                            sx={{ 
                                                color: '#6b7280', 
                                                '&.Mui-focused': { color: '#dc3545' } 
                                            }}
                                        >
                                            Year *
                                        </InputLabel>
                                        <Select 
                                            value={allocateForm.year} 
                                            labelId="year-label"
                                            label="Year *" 
                                            onChange={(e) => setAllocateForm({ ...allocateForm, year: e.target.value })}
                                            sx={{
                                                borderRadius: '8px',
                                                backgroundColor: '#ffffff',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#d1d5db'
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#dc3545'
                                                },
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#dc3545',
                                                    borderWidth: '2px'
                                                }
                                            }}
                                        >
                                            {[2023, 2024, 2025, 2026, 2027].map((year) => (
                                                <MenuItem key={year} value={year}>{year}</MenuItem>
                                            ))}
                                        </Select>
                                        <Typography variant="caption" sx={{ color: '#6b7280', mt: 0.5 }}>
                                            Select the year for leave entitlement allocation
                                        </Typography>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* STEP 2: Leave Entitlement Allocation Section */}
                    <Card sx={{ 
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        border: '1px solid #e5e7eb'
                    }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ 
                                mb: 3, 
                                color: '#1a1a1a', 
                                fontWeight: 600,
                                fontSize: '1.125rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                <Box sx={{ 
                                    backgroundColor: '#dc3545', 
                                    color: 'white', 
                                    borderRadius: '50%', 
                                    width: 24, 
                                    height: 24, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold'
                                }}>
                                    2
                                </Box>
                                Leave Entitlement Allocation
                            </Typography>
                            
                            <Grid container spacing={3}>
                                {/* Sick Leave */}
                                <Grid item xs={12} md={4}>
                                    <Card sx={{ 
                                        border: '2px solid #f3f4f6',
                                        borderRadius: '8px',
                                        '&:hover': {
                                            borderColor: '#dc3545',
                                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Typography variant="subtitle1" sx={{ 
                                                fontWeight: 600, 
                                                color: '#1a1a1a', 
                                                mb: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1
                                            }}>
                                                <Box sx={{ 
                                                    width: 8, 
                                                    height: 8, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: '#ef4444' 
                                                }} />
                                                Sick Leave
                                            </Typography>
                                            <TextField 
                                                fullWidth 
                                                label="Days" 
                                                type="number" 
                                                value={allocateForm.sickLeaveEntitlement} 
                                                onChange={(e) => setAllocateForm({ 
                                                    ...allocateForm, 
                                                    sickLeaveEntitlement: Math.max(0, Math.min(365, parseInt(e.target.value) || 0))
                                                })} 
                                                inputProps={{ 
                                                    min: 0, 
                                                    max: 365,
                                                    onWheel: (e) => e.target.blur() // Prevent scroll changes
                                                }} 
                                                helperText="Enter number of sick leave days (0-365)"
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        '& fieldset': {
                                                            borderColor: '#d1d5db'
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: '#dc3545'
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#dc3545',
                                                            borderWidth: '2px'
                                                        }
                                                    },
                                                    '& .MuiInputLabel-root.Mui-focused': {
                                                        color: '#dc3545'
                                                    }
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Casual Leave */}
                                <Grid item xs={12} md={4}>
                                    <Card sx={{ 
                                        border: '2px solid #f3f4f6',
                                        borderRadius: '8px',
                                        '&:hover': {
                                            borderColor: '#dc3545',
                                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Typography variant="subtitle1" sx={{ 
                                                fontWeight: 600, 
                                                color: '#1a1a1a', 
                                                mb: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1
                                            }}>
                                                <Box sx={{ 
                                                    width: 8, 
                                                    height: 8, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: '#f59e0b' 
                                                }} />
                                                Casual Leave
                                            </Typography>
                                            <TextField 
                                                fullWidth 
                                                label="Days" 
                                                type="number" 
                                                value={allocateForm.casualLeaveEntitlement} 
                                                onChange={(e) => setAllocateForm({ 
                                                    ...allocateForm, 
                                                    casualLeaveEntitlement: Math.max(0, Math.min(365, parseInt(e.target.value) || 0))
                                                })} 
                                                inputProps={{ 
                                                    min: 0, 
                                                    max: 365,
                                                    onWheel: (e) => e.target.blur() // Prevent scroll changes
                                                }} 
                                                helperText="Enter number of casual leave days (0-365)"
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        '& fieldset': {
                                                            borderColor: '#d1d5db'
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: '#dc3545'
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#dc3545',
                                                            borderWidth: '2px'
                                                        }
                                                    },
                                                    '& .MuiInputLabel-root.Mui-focused': {
                                                        color: '#dc3545'
                                                    }
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Planned Leave */}
                                <Grid item xs={12} md={4}>
                                    <Card sx={{ 
                                        border: '2px solid #f3f4f6',
                                        borderRadius: '8px',
                                        '&:hover': {
                                            borderColor: '#dc3545',
                                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Typography variant="subtitle1" sx={{ 
                                                fontWeight: 600, 
                                                color: '#1a1a1a', 
                                                mb: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1
                                            }}>
                                                <Box sx={{ 
                                                    width: 8, 
                                                    height: 8, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: '#10b981' 
                                                }} />
                                                Planned Leave
                                            </Typography>
                                            <TextField 
                                                fullWidth 
                                                label="Days" 
                                                type="number" 
                                                value={allocateForm.paidLeaveEntitlement} 
                                                onChange={(e) => setAllocateForm({ 
                                                    ...allocateForm, 
                                                    paidLeaveEntitlement: Math.max(0, Math.min(365, parseInt(e.target.value) || 0))
                                                })} 
                                                inputProps={{ 
                                                    min: 0, 
                                                    max: 365,
                                                    onWheel: (e) => e.target.blur() // Prevent scroll changes
                                                }} 
                                                helperText="Enter number of planned leave days (0-365)"
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        '& fieldset': {
                                                            borderColor: '#d1d5db'
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: '#dc3545'
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#dc3545',
                                                            borderWidth: '2px'
                                                        }
                                                    },
                                                    '& .MuiInputLabel-root.Mui-focused': {
                                                        color: '#dc3545'
                                                    }
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* STEP 3: Review Summary Section */}
                    {allocateForm.employeeId && (
                        <Card sx={{ 
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            border: '2px solid #dc3545'
                        }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" sx={{ 
                                    mb: 3, 
                                    color: '#1a1a1a', 
                                    fontWeight: 600,
                                    fontSize: '1.125rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                    <Box sx={{ 
                                        backgroundColor: '#dc3545', 
                                        color: 'white', 
                                        borderRadius: '50%', 
                                        width: 24, 
                                        height: 24, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        fontSize: '0.875rem',
                                        fontWeight: 'bold'
                                    }}>
                                        3
                                    </Box>
                                    Review Summary
                                </Typography>
                                
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ 
                                            p: 2.5, 
                                            backgroundColor: '#f9fafb',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb'
                                        }}>
                                            <Typography variant="subtitle2" sx={{ color: '#6b7280', mb: 1 }}>
                                                Employee Details
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                {employees.find(emp => emp._id === allocateForm.employeeId)?.fullName || 'Not Selected'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                                Year: {allocateForm.year}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ 
                                            p: 2.5, 
                                            backgroundColor: '#fef2f2',
                                            borderRadius: '8px',
                                            border: '1px solid #fecaca'
                                        }}>
                                            <Typography variant="subtitle2" sx={{ color: '#6b7280', mb: 1 }}>
                                                Total Entitlement
                                            </Typography>
                                            <Typography variant="h4" sx={{ 
                                                color: '#dc3545', 
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'baseline',
                                                gap: 1
                                            }}>
                                                {allocateForm.sickLeaveEntitlement + allocateForm.casualLeaveEntitlement + allocateForm.paidLeaveEntitlement}
                                                <Typography variant="body1" sx={{ color: '#6b7280' }}>
                                                    days
                                                </Typography>
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', mt: 1 }}>
                                                Sick: {allocateForm.sickLeaveEntitlement} • Casual: {allocateForm.casualLeaveEntitlement} • Planned: {allocateForm.paidLeaveEntitlement}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    )}
                </Stack>
            </DialogContent>

            {/* STEP 4: Action Controls */}
            <DialogActions sx={{ 
                p: 4,
                backgroundColor: '#ffffff',
                borderTop: '2px solid #e5e7eb',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Typography variant="body2" sx={{ color: '#6b7280', fontStyle: 'italic' }}>
                    {!allocateForm.employeeId ? 'Please select an employee to continue' : 
                     'Review the details above before allocating entitlements'}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                        onClick={() => setShowAllocateDialog(false)}
                        variant="outlined"
                        sx={{
                            color: '#6b7280',
                            borderColor: '#d1d5db',
                            px: 4,
                            py: 1.5,
                            borderRadius: '8px',
                            fontWeight: 500,
                            textTransform: 'none',
                            '&:hover': {
                                backgroundColor: '#f9fafb',
                                borderColor: '#9ca3af'
                            }
                        }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleAllocateLeaves} 
                        variant="contained"
                        disabled={!allocateForm.employeeId || !allocateForm.year}
                        sx={{
                            backgroundColor: '#dc3545',
                            color: '#ffffff',
                            fontWeight: 600,
                            px: 6,
                            py: 1.5,
                            borderRadius: '8px',
                            textTransform: 'none',
                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)',
                            '&:hover': {
                                backgroundColor: '#c82333',
                                boxShadow: '0 6px 16px rgba(220, 53, 69, 0.4)'
                            },
                            '&.Mui-disabled': {
                                backgroundColor: '#d1d5db',
                                color: '#9ca3af',
                                boxShadow: 'none'
                            }
                        }}
                    >
                        Allocate Entitlements
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>

        {/* Bulk Allocate Leaves Dialog - REFACTORED UI/UX */}
        <Dialog 
            open={showBulkAllocateDialog} 
            onClose={() => setShowBulkAllocateDialog(false)} 
            maxWidth="xl" 
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    minHeight: '800px',
                    backgroundColor: '#fafafa'
                }
            }}
        >
            {/* Header - Clean & Professional */}
            <DialogTitle sx={{ 
                backgroundColor: '#ffffff',
                color: '#1a1a1a', 
                fontWeight: 600,
                fontSize: '1.5rem',
                py: 3,
                px: 4,
                borderBottom: '2px solid #e5e7eb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Assignment sx={{ color: '#dc3545', fontSize: '1.75rem' }} />
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            color: '#1a1a1a',
                            fontWeight: 600,
                            fontSize: '1.5rem'
                        }}
                    >
                        Bulk Allocate Leave Entitlements
                    </Typography>
                </Box>
                <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ color: '#6b7280', '&.Mui-focused': { color: '#dc3545' } }}>
                        Year
                    </InputLabel>
                    <Select 
                        value={bulkAllocateForm.year} 
                        label="Year"
                        onChange={(e) => setBulkAllocateForm({ ...bulkAllocateForm, year: e.target.value })}
                        sx={{
                            borderRadius: '8px',
                            backgroundColor: '#ffffff',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#d1d5db'
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#dc3545'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#dc3545',
                                borderWidth: '2px'
                            }
                        }}
                    >
                        {[2023, 2024, 2025, 2026, 2027].map((year) => (
                            <MenuItem key={year} value={year}>{year}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </DialogTitle>

            <DialogContent sx={{ 
                backgroundColor: '#fafafa',
                p: 4,
                '&.MuiDialogContent-root': {
                    paddingTop: '32px'
                }
            }}>
                <Stack spacing={4}>
                    {/* STEP 1: Scope Selection Section */}
                    <Card sx={{ 
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        border: '1px solid #e5e7eb'
                    }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ 
                                mb: 3, 
                                color: '#1a1a1a', 
                                fontWeight: 600,
                                fontSize: '1.125rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                <Box sx={{ 
                                    backgroundColor: '#dc3545', 
                                    color: 'white', 
                                    borderRadius: '50%', 
                                    width: 24, 
                                    height: 24, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold'
                                }}>
                                    1
                                </Box>
                                Scope Selection
                            </Typography>
                            
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={8}>
                                    {/* Employee Selection List */}
                                    <Box sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                                                Select Employees
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button 
                                                    size="small" 
                                                    onClick={handleSelectAllEmployees} 
                                                    variant="outlined"
                                                    sx={{ 
                                                        color: '#dc3545',
                                                        borderColor: '#dc3545',
                                                        fontSize: '0.8rem',
                                                        py: 0.5,
                                                        px: 2,
                                                        '&:hover': {
                                                            backgroundColor: '#dc3545',
                                                            color: '#ffffff'
                                                        }
                                                    }}
                                                >
                                                    Select All
                                                </Button>
                                                <Button 
                                                    size="small" 
                                                    onClick={handleDeselectAllEmployees}
                                                    variant="outlined"
                                                    sx={{
                                                        color: '#6b7280',
                                                        borderColor: '#d1d5db',
                                                        fontSize: '0.8rem',
                                                        py: 0.5,
                                                        px: 2,
                                                        '&:hover': {
                                                            backgroundColor: '#f9fafb',
                                                            borderColor: '#9ca3af'
                                                        }
                                                    }}
                                                >
                                                    Clear All
                                                </Button>
                                            </Box>
                                        </Box>
                                        
                                        <Paper sx={{ 
                                            maxHeight: 300, 
                                            overflow: 'auto', 
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px'
                                        }}>
                                            <List dense sx={{ p: 0 }}>
                                                {employees.map((emp) => (
                                                    <ListItem 
                                                        key={emp._id} 
                                                        disablePadding
                                                        sx={{
                                                            borderBottom: '1px solid #f3f4f6',
                                                            '&:hover': {
                                                                backgroundColor: '#f9fafb'
                                                            },
                                                            '&:last-child': {
                                                                borderBottom: 'none'
                                                            }
                                                        }}
                                                    >
                                                        <ListItemButton 
                                                            onClick={() => handleToggleEmployeeSelection(emp._id)}
                                                            sx={{ py: 1, px: 2 }}
                                                        >
                                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                                <Checkbox
                                                                    edge="start"
                                                                    checked={bulkAllocateForm.employeeIds?.includes(emp._id) || false}
                                                                    tabIndex={-1}
                                                                    disableRipple
                                                                    sx={{
                                                                        color: '#dc3545',
                                                                        '&.Mui-checked': {
                                                                            color: '#dc3545'
                                                                        }
                                                                    }}
                                                                />
                                                            </ListItemIcon>
                                                            <ListItemText 
                                                                primary={
                                                                    <Typography sx={{ fontWeight: 500, color: '#1a1a1a', fontSize: '0.9rem' }}>
                                                                        {emp.fullName}
                                                                    </Typography>
                                                                }
                                                                secondary={
                                                                    <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                                                        {emp.employeeCode} • {emp.department || 'No Department'} • {emp.employmentType || 'Permanent'}
                                                                    </Typography>
                                                                }
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </Paper>
                                    </Box>
                                </Grid>
                                
                                <Grid item xs={12} md={4}>
                                    {/* Scope Summary */}
                                    <Box sx={{ 
                                        p: 3, 
                                        backgroundColor: bulkAllocateForm.employeeIds?.length > 0 ? '#fef2f2' : '#f9fafb',
                                        borderRadius: '8px',
                                        border: `2px solid ${bulkAllocateForm.employeeIds?.length > 0 ? '#fecaca' : '#e5e7eb'}`,
                                        textAlign: 'center'
                                    }}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', mb: 1 }}>
                                            Selected Scope
                                        </Typography>
                                        <Typography variant="h3" sx={{ 
                                            color: bulkAllocateForm.employeeIds?.length > 0 ? '#dc3545' : '#9ca3af', 
                                            fontWeight: 'bold',
                                            mb: 1
                                        }}>
                                            {bulkAllocateForm.employeeIds?.length || 0}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>
                                            employee{(bulkAllocateForm.employeeIds?.length || 0) !== 1 ? 's' : ''} selected
                                        </Typography>
                                        {bulkAllocateForm.employeeIds?.length > 0 && (
                                            <Typography variant="caption" sx={{ 
                                                color: '#dc3545', 
                                                fontWeight: 600,
                                                display: 'block',
                                                backgroundColor: '#ffffff',
                                                p: 1,
                                                borderRadius: '4px',
                                                border: '1px solid #fecaca'
                                            }}>
                                                This allocation will apply to {bulkAllocateForm.employeeIds.length} employee{bulkAllocateForm.employeeIds.length !== 1 ? 's' : ''}
                                            </Typography>
                                        )}
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* STEP 2: Leave Entitlement Inputs Section */}
                    <Card sx={{ 
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        border: '1px solid #e5e7eb'
                    }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ 
                                mb: 3, 
                                color: '#1a1a1a', 
                                fontWeight: 600,
                                fontSize: '1.125rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                <Box sx={{ 
                                    backgroundColor: '#dc3545', 
                                    color: 'white', 
                                    borderRadius: '50%', 
                                    width: 24, 
                                    height: 24, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold'
                                }}>
                                    2
                                </Box>
                                Leave Entitlement Inputs
                            </Typography>
                            
                            <Grid container spacing={3}>
                                {/* Sick Leave */}
                                <Grid item xs={12} md={4}>
                                    <Card sx={{ 
                                        border: '2px solid #f3f4f6',
                                        borderRadius: '8px',
                                        '&:hover': {
                                            borderColor: '#dc3545',
                                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Typography variant="subtitle1" sx={{ 
                                                fontWeight: 600, 
                                                color: '#1a1a1a', 
                                                mb: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1
                                            }}>
                                                <Box sx={{ 
                                                    width: 8, 
                                                    height: 8, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: '#ef4444' 
                                                }} />
                                                Sick Leave
                                            </Typography>
                                            <TextField 
                                                fullWidth 
                                                label="Days" 
                                                type="number" 
                                                value={bulkAllocateForm.sickLeaveEntitlement} 
                                                onChange={(e) => setBulkAllocateForm({ 
                                                    ...bulkAllocateForm, 
                                                    sickLeaveEntitlement: Math.max(0, Math.min(365, parseInt(e.target.value) || 0))
                                                })} 
                                                inputProps={{ 
                                                    min: 0, 
                                                    max: 365,
                                                    onWheel: (e) => e.target.blur()
                                                }} 
                                                helperText="Enter sick leave days (0-365)"
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        '& fieldset': {
                                                            borderColor: '#d1d5db'
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: '#dc3545'
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#dc3545',
                                                            borderWidth: '2px'
                                                        }
                                                    },
                                                    '& .MuiInputLabel-root.Mui-focused': {
                                                        color: '#dc3545'
                                                    }
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Casual Leave */}
                                <Grid item xs={12} md={4}>
                                    <Card sx={{ 
                                        border: '2px solid #f3f4f6',
                                        borderRadius: '8px',
                                        '&:hover': {
                                            borderColor: '#dc3545',
                                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Typography variant="subtitle1" sx={{ 
                                                fontWeight: 600, 
                                                color: '#1a1a1a', 
                                                mb: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1
                                            }}>
                                                <Box sx={{ 
                                                    width: 8, 
                                                    height: 8, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: '#f59e0b' 
                                                }} />
                                                Casual Leave
                                            </Typography>
                                            <TextField 
                                                fullWidth 
                                                label="Days" 
                                                type="number" 
                                                value={bulkAllocateForm.casualLeaveEntitlement} 
                                                onChange={(e) => setBulkAllocateForm({ 
                                                    ...bulkAllocateForm, 
                                                    casualLeaveEntitlement: Math.max(0, Math.min(365, parseInt(e.target.value) || 0))
                                                })} 
                                                inputProps={{ 
                                                    min: 0, 
                                                    max: 365,
                                                    onWheel: (e) => e.target.blur()
                                                }} 
                                                helperText="Enter casual leave days (0-365)"
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        '& fieldset': {
                                                            borderColor: '#d1d5db'
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: '#dc3545'
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#dc3545',
                                                            borderWidth: '2px'
                                                        }
                                                    },
                                                    '& .MuiInputLabel-root.Mui-focused': {
                                                        color: '#dc3545'
                                                    }
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Planned Leave */}
                                <Grid item xs={12} md={4}>
                                    <Card sx={{ 
                                        border: '2px solid #f3f4f6',
                                        borderRadius: '8px',
                                        '&:hover': {
                                            borderColor: '#dc3545',
                                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.1)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Typography variant="subtitle1" sx={{ 
                                                fontWeight: 600, 
                                                color: '#1a1a1a', 
                                                mb: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1
                                            }}>
                                                <Box sx={{ 
                                                    width: 8, 
                                                    height: 8, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: '#10b981' 
                                                }} />
                                                Planned Leave
                                            </Typography>
                                            <TextField 
                                                fullWidth 
                                                label="Days" 
                                                type="number" 
                                                value={bulkAllocateForm.paidLeaveEntitlement} 
                                                onChange={(e) => setBulkAllocateForm({ 
                                                    ...bulkAllocateForm, 
                                                    paidLeaveEntitlement: Math.max(0, Math.min(365, parseInt(e.target.value) || 0))
                                                })} 
                                                inputProps={{ 
                                                    min: 0, 
                                                    max: 365,
                                                    onWheel: (e) => e.target.blur()
                                                }} 
                                                helperText="Enter planned leave days (0-365)"
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        '& fieldset': {
                                                            borderColor: '#d1d5db'
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: '#dc3545'
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#dc3545',
                                                            borderWidth: '2px'
                                                        }
                                                    },
                                                    '& .MuiInputLabel-root.Mui-focused': {
                                                        color: '#dc3545'
                                                    }
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* STEP 3: Impact Preview Section */}
                    {bulkAllocateForm.employeeIds?.length > 0 && (
                        <Card sx={{ 
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            border: '2px solid #dc3545'
                        }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" sx={{ 
                                    mb: 3, 
                                    color: '#1a1a1a', 
                                    fontWeight: 600,
                                    fontSize: '1.125rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                    <Box sx={{ 
                                        backgroundColor: '#dc3545', 
                                        color: 'white', 
                                        borderRadius: '50%', 
                                        width: 24, 
                                        height: 24, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        fontSize: '0.875rem',
                                        fontWeight: 'bold'
                                    }}>
                                        3
                                    </Box>
                                    Impact Preview
                                </Typography>
                                
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ 
                                            p: 2.5, 
                                            backgroundColor: '#f9fafb',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb'
                                        }}>
                                            <Typography variant="subtitle2" sx={{ color: '#6b7280', mb: 1 }}>
                                                Allocation Scope
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                {bulkAllocateForm.employeeIds.length} Employee{bulkAllocateForm.employeeIds.length !== 1 ? 's' : ''}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                                Year: {bulkAllocateForm.year}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ 
                                            p: 2.5, 
                                            backgroundColor: '#fef2f2',
                                            borderRadius: '8px',
                                            border: '1px solid #fecaca'
                                        }}>
                                            <Typography variant="subtitle2" sx={{ color: '#6b7280', mb: 1 }}>
                                                Total Entitlement per Employee
                                            </Typography>
                                            <Typography variant="h4" sx={{ 
                                                color: '#dc3545', 
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'baseline',
                                                gap: 1
                                            }}>
                                                {bulkAllocateForm.sickLeaveEntitlement + bulkAllocateForm.casualLeaveEntitlement + bulkAllocateForm.paidLeaveEntitlement}
                                                <Typography variant="body1" sx={{ color: '#6b7280' }}>
                                                    days
                                                </Typography>
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280', mt: 1 }}>
                                                Sick: {bulkAllocateForm.sickLeaveEntitlement} • Casual: {bulkAllocateForm.casualLeaveEntitlement} • Planned: {bulkAllocateForm.paidLeaveEntitlement}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                                
                                {/* Warning Message */}
                                <Box sx={{ 
                                    mt: 3,
                                    p: 2.5,
                                    backgroundColor: '#fef3cd',
                                    borderRadius: '8px',
                                    border: '1px solid #fde68a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2
                                }}>
                                    <Box sx={{ 
                                        backgroundColor: '#f59e0b',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: 24,
                                        height: 24,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.875rem',
                                        fontWeight: 'bold'
                                    }}>
                                        !
                                    </Box>
                                    <Typography variant="body2" sx={{ color: '#92400e', fontWeight: 500 }}>
                                        <strong>Warning:</strong> This action will update entitlements for all {bulkAllocateForm.employeeIds.length} selected employee{bulkAllocateForm.employeeIds.length !== 1 ? 's' : ''}. This operation cannot be undone.
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    )}
                </Stack>
            </DialogContent>

            {/* STEP 4: Action Controls */}
            <DialogActions sx={{ 
                p: 4,
                backgroundColor: '#ffffff',
                borderTop: '2px solid #e5e7eb',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Typography variant="body2" sx={{ color: '#6b7280', fontStyle: 'italic' }}>
                    {!bulkAllocateForm.employeeIds?.length ? 'Please select employees to continue' : 
                     `Ready to allocate entitlements to ${bulkAllocateForm.employeeIds.length} employee${bulkAllocateForm.employeeIds.length !== 1 ? 's' : ''}`}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                        onClick={() => {
                            setShowBulkAllocateDialog(false);
                            setBulkAllocateForm({ ...bulkAllocateForm, employeeIds: [] });
                        }}
                        variant="outlined"
                        sx={{
                            color: '#6b7280',
                            borderColor: '#d1d5db',
                            px: 4,
                            py: 1.5,
                            borderRadius: '8px',
                            fontWeight: 500,
                            textTransform: 'none',
                            '&:hover': {
                                backgroundColor: '#f9fafb',
                                borderColor: '#9ca3af'
                            }
                        }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleBulkAllocateLeaves} 
                        variant="contained"
                        disabled={!bulkAllocateForm.employeeIds?.length || bulkAllocateForm.employeeIds.length === 0}
                        sx={{
                            backgroundColor: '#dc3545',
                            color: '#ffffff',
                            fontWeight: 600,
                            px: 6,
                            py: 1.5,
                            borderRadius: '8px',
                            textTransform: 'none',
                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)',
                            '&:hover': {
                                backgroundColor: '#c82333',
                                boxShadow: '0 6px 16px rgba(220, 53, 69, 0.4)'
                            },
                            '&.Mui-disabled': {
                                backgroundColor: '#d1d5db',
                                color: '#9ca3af',
                                boxShadow: 'none'
                            }
                        }}
                    >
                        Bulk Allocate Entitlements
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>

        {/* Assign Leave Dialog */}
        <AdminLeaveForm
            open={showAssignDialog}
            onClose={() => {
                setShowAssignDialog(false);
                setAssignLeaveRequest(null);
            }}
            onSave={handleAssignLeave}
            request={assignLeaveRequest}
            employees={employees}
            isSaving={isAssigningLeave}
        />
        
        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}><Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>{snackbar.message}</Alert></Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default LeavesTrackerPage;