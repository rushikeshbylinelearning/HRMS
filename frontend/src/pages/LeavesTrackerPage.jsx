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
  Stack
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
    // --- START OF FIX: Use entitlements as the source of truth for total leaves ---
    const entitlements = {
        sick: employee.leaveEntitlements?.sick ?? 12,
        casual: employee.leaveEntitlements?.casual ?? 12,
        paid: employee.leaveEntitlements?.paid ?? 0,
    };

    const used = { sick: 0, casual: 0, paid: 0, unpaid: 0 };
    leaves.forEach(leave => {
        if (leave.status === 'Approved') {
            const days = leave.leaveDates.length * (leave.leaveType.startsWith('Half Day') ? 0.5 : 1);
            if (leave.requestType === 'Sick') used.sick += days;
            else if (leave.requestType === 'Planned') used.casual += days; // Mapping "Planned" request type to "Casual" leave
            else if (leave.requestType === 'Loss of Pay') used.unpaid += days;
        }
    });

    const totalUsed = used.sick + used.casual + used.paid;
    const totalEntitlement = entitlements.sick + entitlements.casual + entitlements.paid;

    return {
        entitlements,
        used,
        balances: {
            sick: employee.leaveBalances?.sick ?? entitlements.sick,
            casual: employee.leaveBalances?.casual ?? entitlements.casual,
            paid: employee.leaveBalances?.paid ?? entitlements.paid,
        },
        totalUsed,
        totalEntitlement,
    };
    // --- END OF FIX ---
  };

  const filteredLeaveData = useMemo(() => {
    return leaveData.filter(data => {
      const emp = data.employee;
      const matchesSearch = !searchTerm || emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = !selectedDepartment || emp.department === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });
  }, [leaveData, searchTerm, selectedDepartment]);

  const departments = useMemo(() => {
    const deptSet = new Set(employees.map(emp => emp.department).filter(Boolean));
    return Array.from(deptSet).sort();
  }, [employees]);
  
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
  
  // Fetch leave usage data for a specific year
  // When year is selected (e.g., 2024), we show data for the previous year (2023) that led to the current year's balance
  const fetchLeaveUsageForYear = useCallback(async (employeeId, year, employeeData) => {
    if (!employeeId || !year) return;
    
    setLoadingLeaveUsage(true);
    try {
      // Get previous year (year - 1) - this is what we're analyzing for year-end summary
      const previousYear = year - 1;
      
      // Fetch all leave requests for this employee:
      // 1. Previous year (for year-end summary calculations)
      // 2. Current year (for KPI calculations - showing current year usage)
      const [leaveRequestsResPrevious, leaveRequestsResCurrent, yearEndRes] = await Promise.all([
        axios.get(`/admin/leaves/employee/${employeeId}?year=${previousYear}`),
        axios.get(`/admin/leaves/employee/${employeeId}?year=${year}`), // Current year for KPIs
        axios.get(`/admin/leaves/year-end-requests?year=${previousYear}&limit=100`)
      ]);

      const allLeaveRequestsPrevious = leaveRequestsResPrevious.data || [];
      const allLeaveRequestsCurrent = leaveRequestsResCurrent.data || [];
      
      // Filter out YEAR_END requests from normal leave requests
      const normalLeaveRequestsPrevious = allLeaveRequestsPrevious.filter(r => r.requestType !== 'YEAR_END');
      const normalLeaveRequestsCurrent = allLeaveRequestsCurrent.filter(r => r.requestType !== 'YEAR_END');
      
      // Filter year-end requests for this employee (for the previous year)
      const employeeYearEndRequests = (yearEndRes.data.requests || yearEndRes.data || []).filter(req => 
        req.employee?._id === employeeId || req.employee === employeeId
      );

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
      
      // Fetch Year-End requests
      axios.get(`/admin/leaves/year-end-requests?limit=100`)
        .then(res => {
          // Filter Year-End requests for this employee
          const employeeYearEndRequests = (res.data.requests || []).filter(req => 
            req.employee?._id === dialogEmployee._id || req.employee === dialogEmployee._id
          );
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
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} sx={{ backgroundColor: '#2C3E50', borderRadius: '12px', p: 2 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={handleBack} size="small" sx={{ color: '#FFFFFF' }}><ArrowBack /></IconButton>
            <Typography variant="h4" component="h1" sx={{ color: '#FFFFFF', fontWeight: 'bold' }}>Employee Leaves Tracker</Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button variant="contained" startIcon={<Add />} onClick={() => { setAssignLeaveRequest(null); setShowAssignDialog(true); }} sx={{ backgroundColor: '#28a745', '&:hover': { backgroundColor: '#218838' } }}>Assign Leave</Button>
            <Button variant="contained" startIcon={<Assignment />} onClick={() => setShowAllocateDialog(true)} sx={{ backgroundColor: '#17a2b8', '&:hover': { backgroundColor: '#138496' } }}>Allocate Leaves</Button>
            <Button variant="contained" startIcon={<Group />} onClick={() => setShowBulkAllocateDialog(true)} sx={{ backgroundColor: '#6f42c1', '&:hover': { backgroundColor: '#5a32a3' } }}>Bulk Allocate</Button>
          </Box>
        </Box>
        
        <Card sx={{ mb: 3, borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Leave Balances" />
                <Tab label="Leave Requests" />
                <Tab label="Saturday Schedule" />
            </Tabs>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Card sx={{ borderRadius: '16px', mb: 3 }}>
            <CardContent>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} size="small" /></Grid>
                    <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Department</InputLabel><Select value={selectedDepartment} label="Department" onChange={(e) => setSelectedDepartment(e.target.value)}><MenuItem value="">All Departments</MenuItem>{departments.map((dept) => (<MenuItem key={dept} value={dept}>{dept}</MenuItem>))}</Select></FormControl></Grid>
                    <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Employee</InputLabel><Select value={selectedEmployee} label="Employee" onChange={(e) => setSelectedEmployee(e.target.value)}><MenuItem value="">All Employees</MenuItem>{employees.map((emp) => (<MenuItem key={emp._id} value={emp._id}>{emp.fullName} ({emp.employeeCode})</MenuItem>))}</Select></FormControl></Grid>
                    <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Year</InputLabel><Select value={selectedYear} label="Year" onChange={(e) => setSelectedYear(e.target.value)}>{[2023, 2024, 2025, 2026].map((year) => (<MenuItem key={year} value={year}>{year}</MenuItem>))}</Select></FormControl></Grid>
                </Grid>
            </CardContent>
        </Card>
        
    {/* --- START OF FIX: Dynamic Table Rendering --- */}
        {activeTab === 0 && (
            <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#dc3545' }}>Leave Balances Overview</Typography>
                    {filteredLeaveData.length === 0 ? (<Box textAlign="center" py={4}><Typography variant="h6" color="textSecondary">No leave data found for the selected filters.</Typography></Box>) : (
                    <Box sx={{ overflowX: 'auto' }}>
                        <Table><TableHead><TableRow sx={{ backgroundColor: '#f8f9fa' }}><TableCell sx={{ fontWeight: 'bold' }}>Employee</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Department</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Total Leave (Used/Total)</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Sick Leave</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Casual Leave</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Planned Leave</TableCell><TableCell sx={{ fontWeight: 'bold' }}>LOP Loss of Pay</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell></TableRow></TableHead>
                            <TableBody>
                                {filteredLeaveData.map((data) => {
                                    const { employee, balances } = data;
                                    const { totalUsed, totalEntitlement } = balances;
                                    const { used, entitlements } = balances;

                                    return (
                                        <TableRow 
                                            key={employee._id} 
                                            hover 
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => {
                                                setDialogEmployee(employee);
                                                setSelectedRequest(null);
                                                setShowEmployeeDialog(true);
                                            }}
                                        >
                                            <TableCell><Box display="flex" alignItems="center" gap={1}><Avatar src={employee.profileImageUrl} sx={{ width: 30, height: 30 }}>{employee.fullName.charAt(0)}</Avatar><Box><Typography variant="body2" fontWeight="bold">{employee.fullName}</Typography><Typography variant="caption" color="textSecondary">{employee.employeeCode}</Typography></Box></Box></TableCell>
                                            <TableCell>{employee.department || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">{totalUsed} / {totalEntitlement} days</Typography>
                                                <LinearProgress variant="determinate" value={(totalUsed / totalEntitlement) * 100 || 0} color={getProgressColor(totalUsed, totalEntitlement)} sx={{ height: 8, borderRadius: 5, backgroundColor: '#e0e0e0' }} />
                                                <Typography variant="caption" color="textSecondary">{((totalUsed / totalEntitlement) * 100 || 0).toFixed(1)}% used</Typography>
                                            </TableCell>
                                            <TableCell><Typography variant="body2">Used: {used.sick}</Typography><Typography variant="body2">Balance: {balances.balances.sick}</Typography><Typography variant="caption" color="textSecondary">Total: {entitlements.sick}</Typography></TableCell>
                                            <TableCell><Typography variant="body2">Used: {used.casual}</Typography><Typography variant="body2">Balance: {balances.balances.casual}</Typography><Typography variant="caption" color="textSecondary">Total: {entitlements.casual}</Typography></TableCell>
                                            <TableCell><Typography variant="body2">Used: {used.paid}</Typography><Typography variant="body2">Balance: {balances.balances.paid}</Typography><Typography variant="caption" color="textSecondary">Total: {entitlements.paid}</Typography></TableCell>
                                            <TableCell><Typography variant="body2">Used: {used.unpaid}</Typography></TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Box display="flex" gap={1}>
                                                    <Tooltip title="Assign Leave">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => { 
                                                                setAssignLeaveRequest({ employee: { _id: employee._id } }); 
                                                                setShowAssignDialog(true); 
                                                            }} 
                                                            sx={{ color: '#28a745' }}
                                                        >
                                                            <Add />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="View Leave History">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => {
                                                                setDialogEmployee(employee);
                                                                setSelectedRequest(null);
                                                                setShowEmployeeDialog(true);
                                                            }}
                                                            sx={{ color: '#17a2b8' }}
                                                        >
                                                            <History />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Allocate Leaves">
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => { 
                                                                setAllocateForm({ ...allocateForm, employeeId: employee._id }); 
                                                                setShowAllocateDialog(true); 
                                                            }} 
                                                            sx={{ color: '#17a2b8' }}
                                                        >
                                                            <Assignment />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Box>
                )}
                </CardContent>
            </Card>
        )}
        {/* Leave Requests Tab */}
        {activeTab === 1 && (
            <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#dc3545' }}>Leave Requests</Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
                        <Grid item xs={12} sm={4} md={3}>
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
                        <Grid item xs={12} sm={4} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Week</InputLabel>
                                <Select value={selectedWeek} label="Week" onChange={(e) => setSelectedWeek(e.target.value)}>
                                    <MenuItem value="">All Weeks</MenuItem>
                                    {[1,2,3,4,5].map(w => (<MenuItem key={w} value={w}>{`Week ${w}`}</MenuItem>))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4} md={6}>
                            <Typography variant="body2" color="text.secondary">Filters apply to the first date of the leave request. Use Search / Department / Employee selectors above for additional filtering.</Typography>
                        </Grid>
                    </Grid>

                    <Box sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Employee</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Department</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Leave Type</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Dates</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Days</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Applied On</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {/** Rendered via memo below - show placeholder while loading */}
                                {(() => {
                                    const getWeekOfMonth = (d) => {
                                        try {
                                            const date = new Date(d);
                                            if (isNaN(date)) return null;
                                            return Math.ceil(date.getDate() / 7);
                                        } catch (e) { return null; }
                                    };

                                    const filteredRequests = leaveRequests.filter(req => {
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

                                    if (filteredRequests.length === 0) {
                                        return (<TableRow><TableCell colSpan={8}><Box textAlign="center" py={4}><Typography variant="h6" color="textSecondary">No leave requests found for the selected filters.</Typography></Box></TableCell></TableRow>);
                                    }

                                    return filteredRequests.map(req => {
                                        const emp = req.employee || {};
                                        const dates = Array.isArray(req.leaveDates) ? req.leaveDates : [];
                                        const days = dates.length * (req.leaveType && req.leaveType.startsWith('Half Day') ? 0.5 : 1);
                                        const appliedOn = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : (dates[0] ? new Date(dates[0]).toLocaleDateString() : 'N/A');
                                        return (
                                            <TableRow key={req._id} hover sx={{ cursor: 'pointer' }} onClick={() => { setDialogEmployee(emp); setSelectedRequest(req); setShowEmployeeDialog(true); }}>
                                                <TableCell><Box display="flex" alignItems="center" gap={1}><Avatar sx={{ width: 30, height: 30 }}>{(emp.fullName || '').charAt(0)}</Avatar><Box><Typography variant="body2" fontWeight="bold">{emp.fullName || 'Unknown'}</Typography><Typography variant="caption" color="textSecondary">{emp.employeeCode || ''}</Typography></Box></Box></TableCell>
                                                <TableCell>{emp.department || 'N/A'}</TableCell>
                                                <TableCell>{formatLeaveRequestType(req.requestType) || 'N/A'}</TableCell>
                                                <TableCell>{req.leaveType || 'N/A'}</TableCell>
                                                <TableCell>{dates.map(d => (new Date(d)).toLocaleDateString()).join(', ')}</TableCell>
                                                <TableCell>{days}</TableCell>
                                                <TableCell><Chip label={req.status || 'Pending'} color={req.status === 'Approved' ? 'success' : req.status === 'Rejected' ? 'error' : 'warning'} size="small" /></TableCell>
                                                <TableCell>{appliedOn}</TableCell>
                                            </TableRow>
                                        );
                                    });
                                })()}
                            </TableBody>
                        </Table>
                    </Box>
                </CardContent>
            </Card>
        )}

        {activeTab === 2 && (
            <SaturdayScheduleManager employees={employees} onUpdate={fetchAllData} />
        )}
        
        <Dialog
            open={showEmployeeDialog}
            onClose={() => {
                setShowEmployeeDialog(false);
                setYearEndHistory([]);
                setLeaveUsageData(null);
                setDialogSelectedYear(new Date().getFullYear());
            }}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: '#ffffff',
                    borderRadius: 2,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                    p: 0,
                }
            }}
        >
            <DialogTitle sx={{ color: '#000000', fontWeight: 700, px: 3, pt: 3, pb: 2, borderBottom: '2px solid #D32F2F', bgcolor: '#FFFFFF' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h5" component="span" sx={{ color: '#000000' }}>Employee Leave History</Typography>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ color: '#000000' }}>Select Year</InputLabel>
                        <Select
                            value={dialogSelectedYear}
                            label="Select Year"
                            onChange={(e) => {
                                const newYear = e.target.value;
                                setDialogSelectedYear(newYear);
                                if (dialogEmployee?._id) {
                                    fetchLeaveUsageForYear(dialogEmployee._id, newYear, dialogEmployee);
                                }
                            }}
                            sx={{
                                color: '#000000',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#000000'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#000000'
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#D32F2F'
                                }
                            }}
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                <MenuItem key={year} value={year} sx={{ color: '#000000' }}>{year}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </DialogTitle>
            <DialogContent sx={{ px: 3, pb: 2, maxHeight: '80vh', overflowY: 'auto' }}>
                {dialogEmployee ? (
                    <Box sx={{ color: '#000000' }}>
                        {/* Employee Basic Info */}
                        <Box display="flex" alignItems="center" gap={2} sx={{ mb: 3 }}>
                            <Avatar sx={{ width: 56, height: 56, bgcolor: '#D32F2F', color: '#FFFFFF' }}>
                                {(dialogEmployee.fullName || '').charAt(0)}
                            </Avatar>
                            <Box flex={1}>
                                <Typography variant="h6" sx={{ color: '#000000', fontWeight: 700 }}>
                                    {dialogEmployee.fullName || 'Unknown'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#000000' }}>
                                    {dialogEmployee.employeeCode || 'N/A'} • {dialogEmployee.department || 'N/A'}
                                </Typography>
                            </Box>
                        </Box>

                        {loadingLeaveUsage || loadingYearEndHistory ? (
                            <Box display="flex" justifyContent="center" py={4}>
                                <CircularProgress />
                            </Box>
                        ) : !leaveUsageData ? (
                            <Alert sx={{ bgcolor: '#FFFFFF', color: '#000000', border: '1px solid #E0E0E0' }}>
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
                                            {/* TOP SUMMARY BANNER - BIG, BOLD, NON-NEGOTIABLE */}
                                            <Paper 
                                                elevation={3} 
                                                sx={{ 
                                                    p: 3, 
                                                    mb: 3, 
                                                    bgcolor: '#FFFFFF', 
                                                    borderRadius: 2,
                                                    border: '2px solid #D32F2F'
                                                }}
                                            >
                                                <Typography 
                                                    variant="h6" 
                                                    sx={{ 
                                                        mb: 2, 
                                                        color: '#000000', 
                                                        fontWeight: 700,
                                                        fontSize: '1.1rem',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        borderBottom: '2px solid #D32F2F',
                                                        pb: 1
                                                    }}
                                                >
                                                    LEAVE SUMMARY ({leaveUsageData.previousYear} → {leaveUsageData.year})
                                                </Typography>
                                                
                                                <Grid container spacing={3}>
                                                    <Grid item xs={12} sm={4}>
                                                        <Box sx={{ textAlign: 'center' }}>
                                                            <Typography variant="body2" sx={{ mb: 1, color: '#000000' }}>
                                                                Previous Year Opening Balance
                                                            </Typography>
                                                            <Typography 
                                                                variant="h3" 
                                                                sx={{ 
                                                                    fontWeight: 700, 
                                                                    color: '#000000',
                                                                    fontSize: '2.5rem'
                                                                }}
                                                            >
                                                                {totalOpening.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400 }}>DAYS</span>
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={4}>
                                                        <Box sx={{ textAlign: 'center' }}>
                                                            <Typography variant="body2" sx={{ mb: 1, color: '#000000' }}>
                                                                Leaves Used During Year
                                                            </Typography>
                                                            <Typography 
                                                                variant="h3" 
                                                                sx={{ 
                                                                    fontWeight: 700, 
                                                                    color: '#000000',
                                                                    fontSize: '2.5rem'
                                                                }}
                                                            >
                                                                {totalUtilized.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400 }}>DAYS</span>
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={12} sm={4}>
                                                        <Box sx={{ textAlign: 'center' }}>
                                                            <Typography variant="body2" sx={{ mb: 1, color: '#000000' }}>
                                                                Remaining at Year End
                                                            </Typography>
                                                            <Typography 
                                                                variant="h3" 
                                                                sx={{ 
                                                                    fontWeight: 700, 
                                                                    color: '#000000',
                                                                    fontSize: '2.5rem'
                                                                }}
                                                            >
                                                                {totalRemaining.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400 }}>DAYS</span>
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                </Grid>
                                            </Paper>

                                            {/* YEAR-END DECISION - CENTER STAGE */}
                                            <Paper 
                                                elevation={2} 
                                                sx={{ 
                                                    p: 3, 
                                                    mb: 3, 
                                                    bgcolor: '#FFFFFF',
                                                    borderRadius: 2,
                                                    border: '1px solid #E0E0E0'
                                                }}
                                            >
                                                <Typography 
                                                    variant="h6" 
                                                    sx={{ 
                                                        mb: 2, 
                                                        color: '#000000', 
                                                        fontWeight: 700,
                                                        fontSize: '1rem',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        borderLeft: '4px solid #D32F2F',
                                                        pl: 1.5
                                                    }}
                                                >
                                                    YEAR-END ACTION TAKEN
                                                </Typography>
                                                
                                                {primaryYearEndAction ? (
                                                    <Box>
                                                        <Box sx={{ mb: 2 }}>
                                                            {primaryYearEndAction.yearEndSubType === 'CARRY_FORWARD' ? (
                                                                <Typography 
                                                                    variant="h4" 
                                                                    sx={{ 
                                                                        fontWeight: 700, 
                                                                        color: '#000000',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 1,
                                                                        flexWrap: 'wrap'
                                                                    }}
                                                                >
                                                                    <ArrowUpward sx={{ fontSize: 32, color: '#D32F2F' }} />
                                                                    Carry Forward: <span style={{ fontSize: '2rem' }}>{primaryYearEndAction.yearEndDays || 0} DAYS</span>
                                                                    {primaryYearEndAction.yearEndLeaveType && (
                                                                        <Chip 
                                                                            label={primaryYearEndAction.yearEndLeaveType} 
                                                                            size="small" 
                                                                            sx={{ 
                                                                                ml: 1, 
                                                                                fontSize: '0.875rem',
                                                                                bgcolor: '#FFFFFF',
                                                                                color: '#000000',
                                                                                border: '1px solid #000000'
                                                                            }}
                                                                        />
                                                                    )}
                                                                </Typography>
                                                            ) : (
                                                                <Typography 
                                                                    variant="h4" 
                                                                    sx={{ 
                                                                        fontWeight: 700, 
                                                                        color: '#000000',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 1,
                                                                        flexWrap: 'wrap'
                                                                    }}
                                                                >
                                                                    <AttachMoney sx={{ fontSize: 32, color: '#D32F2F' }} />
                                                                    Encashed: <span style={{ fontSize: '2rem' }}>{primaryYearEndAction.yearEndDays || 0} DAYS</span>
                                                                    {primaryYearEndAction.yearEndLeaveType && (
                                                                        <Chip 
                                                                            label={primaryYearEndAction.yearEndLeaveType} 
                                                                            size="small" 
                                                                            sx={{ 
                                                                                ml: 1, 
                                                                                fontSize: '0.875rem',
                                                                                bgcolor: '#FFFFFF',
                                                                                color: '#000000',
                                                                                border: '1px solid #000000'
                                                                            }}
                                                                        />
                                                                    )}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                        
                                                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #E0E0E0' }}>
                                                            <Grid container spacing={2}>
                                                                <Grid item xs={12} sm={6}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        {primaryYearEndAction.status === 'Approved' && <CheckCircle sx={{ color: '#000000', fontSize: 20 }} />}
                                                                        {primaryYearEndAction.status === 'Rejected' && <Cancel sx={{ color: '#D32F2F', fontSize: 20 }} />}
                                                                        {primaryYearEndAction.status === 'Pending' && <Pending sx={{ color: '#000000', fontSize: 20 }} />}
                                                                        <Typography variant="body1" sx={{ color: '#000000' }}>
                                                                            <strong>Status:</strong>{' '}
                                                                            <Chip
                                                                                label={primaryYearEndAction.status}
                                                                                size="small"
                                                                                sx={{ 
                                                                                    ml: 1,
                                                                                    bgcolor: '#FFFFFF',
                                                                                    color: '#000000',
                                                                                    border: primaryYearEndAction.status === 'Approved' 
                                                                                        ? '1px solid #D32F2F' 
                                                                                        : primaryYearEndAction.status === 'Rejected'
                                                                                        ? '1px solid #D32F2F'
                                                                                        : '1px dashed #000000'
                                                                                }}
                                                                            />
                                                                        </Typography>
                                                                    </Box>
                                                                </Grid>
                                                                {primaryYearEndAction.approvedBy && (
                                                                    <Grid item xs={12} sm={6}>
                                                                        <Typography variant="body1" sx={{ color: '#000000' }}>
                                                                            <strong>Approved By:</strong> {primaryYearEndAction.approvedBy?.fullName || 'N/A'}
                                                                        </Typography>
                                                                    </Grid>
                                                                )}
                                                                {primaryYearEndAction.approvedAt && (
                                                                    <Grid item xs={12} sm={6}>
                                                                        <Typography variant="body1" sx={{ color: '#000000' }}>
                                                                            <strong>Approval Date:</strong> {new Date(primaryYearEndAction.approvedAt).toLocaleDateString()}
                                                                        </Typography>
                                                                    </Grid>
                                                                )}
                                                                {primaryYearEndAction.status === 'Rejected' && (
                                                                    <Grid item xs={12}>
                                                                        <Alert 
                                                                            sx={{ 
                                                                                mt: 1,
                                                                                bgcolor: '#FFFFFF',
                                                                                color: '#000000',
                                                                                border: '1px solid #D32F2F'
                                                                            }}
                                                                        >
                                                                            Year-End request rejected — no change in balance
                                                                        </Alert>
                                                                    </Grid>
                                                                )}
                                                            </Grid>
                                                        </Box>
                                                    </Box>
                                                ) : totalRemaining <= 0 ? (
                                                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#000000' }}>
                                                        No leaves available to carry forward or encash
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#000000' }}>
                                                        No Year-End Action Taken
                                                    </Typography>
                                                )}
                                            </Paper>

                                            {/* CURRENT YEAR REALITY - MOST IMPORTANT */}
                                            <Paper 
                                                elevation={4} 
                                                sx={{ 
                                                    p: 3, 
                                                    mb: 3, 
                                                    bgcolor: '#FFFFFF',
                                                    borderRadius: 2,
                                                    border: '2px solid #D32F2F'
                                                }}
                                            >
                                                <Typography 
                                                    variant="h6" 
                                                    sx={{ 
                                                        mb: 2, 
                                                        color: '#000000', 
                                                        fontWeight: 700,
                                                        fontSize: '1rem',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        borderLeft: '4px solid #D32F2F',
                                                        pl: 1.5
                                                    }}
                                                >
                                                    <CalendarToday sx={{ fontSize: 24, color: '#D32F2F' }} />
                                                    LEAVES AVAILABLE FROM 1st JANUARY {leaveUsageData.year}
                                                </Typography>
                                                
                                                <Box sx={{ textAlign: 'center', py: 2 }}>
                                                    <Typography 
                                                        variant="h2" 
                                                        sx={{ 
                                                            fontWeight: 700, 
                                                            color: '#000000',
                                                            mb: 1
                                                        }}
                                                    >
                                                        {totalCurrentBalance.toFixed(1)} <span style={{ fontSize: '1.5rem', fontWeight: 400 }}>DAYS</span>
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ color: '#000000' }}>
                                                        Opening Balance (after carry forward / encash)
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mt: 1, color: '#000000' }}>
                                                        Effective From: <strong>01 January {leaveUsageData.year}</strong>
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
                    <Typography variant="body2" sx={{ color: '#000000' }}>No employee data available.</Typography>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, borderTop: '1px solid #E0E0E0' }}>
                <Button
                    onClick={() => {
                        setShowEmployeeDialog(false);
                        setYearEndHistory([]);
                        setLeaveUsageData(null);
                        setDialogSelectedYear(new Date().getFullYear());
                    }}
                    variant="contained"
                    sx={{ 
                        backgroundColor: '#D32F2F', 
                        '&:hover': { backgroundColor: '#B71C1C' }, 
                        color: '#FFFFFF',
                        border: 'none'
                    }}
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>

        <Dialog 
            open={showAllocateDialog} 
            onClose={() => setShowAllocateDialog(false)} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
                }
            }}
        >
            {/* Header */}
            <DialogTitle sx={{ 
                background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                color: '#ffffff', 
                fontWeight: 'bold',
                fontSize: '1.375rem',
                py: 2.5,
                px: 3,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                position: 'relative',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'rgba(255,255,255,0.2)'
                }
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Assignment sx={{ color: '#ffffff', fontSize: '1.5rem' }} />
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '1.375rem',
                            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                    >
                        Allocate Leave Entitlements
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ 
                backgroundColor: '#ffffff',
                p: '20px',
                '&.MuiDialogContent-root': {
                    paddingTop: '20px'
                }
            }}>
                <Stack spacing={2}>
                    {/* Employee and Year Selection - Side by Side */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Autocomplete
                                options={employees}
                                getOptionLabel={(option) => `${option.fullName} (${option.employeeCode})`}
                                value={employees.find(emp => emp._id === allocateForm.employeeId) || null}
                                onChange={(event, newValue) => {
                                    setAllocateForm({ ...allocateForm, employeeId: newValue?._id || '' });
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Employee"
                                        required
                                        aria-label="Select employee"
                                        aria-required="true"
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '8px',
                                                '& fieldset': {
                                                    borderColor: allocateForm.employeeId ? '#dc3545' : '#d0d0d0',
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
                                sx={{
                                    '& .MuiAutocomplete-inputRoot': {
                                        paddingTop: '8px !important',
                                        paddingBottom: '8px !important'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel 
                                    id="year-label"
                                    sx={{ 
                                        color: '#6c757d', 
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
                                    aria-label="Select year"
                                    aria-required="true"
                                    sx={{
                                        borderRadius: '8px',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#d0d0d0'
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#dc3545',
                                            borderWidth: '2px'
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#dc3545',
                                            borderWidth: '2px'
                                        },
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            transform: 'translateY(-1px)',
                                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.1)'
                                        }
                                    }}
                                >
                                    {[2023, 2024, 2025, 2026, 2027].map((year) => (
                                        <MenuItem key={year} value={year}>{year}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    {/* Leave Entitlements Section */}
                    <Box>
                        <Typography variant="h6" sx={{ 
                            mb: 2, 
                            color: '#dc3545', 
                            fontWeight: 'bold',
                            fontSize: '1.1rem'
                        }}>
                            Leave Entitlements
                        </Typography>
                        
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} sm={4}>
                                <TextField 
                                    fullWidth 
                                    label="Sick Leave Entitlement" 
                                    type="number" 
                                    value={allocateForm.sickLeaveEntitlement} 
                                    onChange={(e) => setAllocateForm({ ...allocateForm, sickLeaveEntitlement: parseInt(e.target.value) || 0 })} 
                                    inputProps={{ min: 0, max: 365 }} 
                                    aria-label="Sick leave entitlement"
                                    sx={{
                                        borderRadius: '8px',
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '8px',
                                            '& fieldset': {
                                                borderColor: '#d0d0d0'
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#dc3545',
                                                borderWidth: '2px'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#dc3545',
                                                borderWidth: '2px'
                                            }
                                        },
                                        '& .MuiInputLabel-root.Mui-focused': {
                                            color: '#dc3545'
                                        },
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            transform: 'translateY(-1px)',
                                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.1)'
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField 
                                    fullWidth 
                                    label="Casual Leave Entitlement" 
                                    type="number" 
                                    value={allocateForm.casualLeaveEntitlement} 
                                    onChange={(e) => setAllocateForm({ ...allocateForm, casualLeaveEntitlement: parseInt(e.target.value) || 0 })} 
                                    inputProps={{ min: 0, max: 365 }} 
                                    aria-label="Casual leave entitlement"
                                    sx={{
                                        borderRadius: '8px',
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '8px',
                                            '& fieldset': {
                                                borderColor: '#d0d0d0'
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#dc3545',
                                                borderWidth: '2px'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#dc3545',
                                                borderWidth: '2px'
                                            }
                                        },
                                        '& .MuiInputLabel-root.Mui-focused': {
                                            color: '#dc3545'
                                        },
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            transform: 'translateY(-1px)',
                                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.1)'
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField 
                                    fullWidth 
                                    label="Planned Leave Entitlement" 
                                    type="number" 
                                    value={allocateForm.paidLeaveEntitlement} 
                                    onChange={(e) => setAllocateForm({ ...allocateForm, paidLeaveEntitlement: parseInt(e.target.value) || 0 })} 
                                    inputProps={{ min: 0, max: 365 }} 
                                    aria-label="Planned leave entitlement"
                                    sx={{
                                        borderRadius: '8px',
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '8px',
                                            '& fieldset': {
                                                borderColor: '#d0d0d0'
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#dc3545',
                                                borderWidth: '2px'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#dc3545',
                                                borderWidth: '2px'
                                            }
                                        },
                                        '& .MuiInputLabel-root.Mui-focused': {
                                            color: '#dc3545'
                                        },
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            transform: 'translateY(-1px)',
                                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.1)'
                                        }
                                    }}
                                />
                            </Grid>
                        </Grid>

                        {/* Summary Box */}
                        <Box sx={{ 
                            p: 2.5, 
                            background: 'linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%)',
                            borderRadius: '12px',
                            border: '2px solid #dc3545',
                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.1)'
                        }}>
                            <Box>
                                <Typography variant="body2" sx={{ color: '#666', mb: 0.5, fontSize: '0.875rem', fontWeight: 500 }}>
                                    Total Entitlement
                                </Typography>
                                <Typography variant="h5" sx={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1.5rem' }}>
                                    {allocateForm.sickLeaveEntitlement + allocateForm.casualLeaveEntitlement + allocateForm.paidLeaveEntitlement} days
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Stack>
            </DialogContent>

            {/* Footer Actions */}
            <DialogActions sx={{ 
                p: '20px',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e0e0e0',
                justifyContent: 'flex-end',
                gap: 2,
                flexWrap: { xs: 'wrap', sm: 'nowrap' }
            }}>
                <Button 
                    onClick={() => setShowAllocateDialog(false)}
                    variant="outlined"
                    sx={{
                        color: '#dc3545',
                        borderColor: '#dc3545',
                        borderWidth: '1.5px',
                        px: 3,
                        py: 1.25,
                        minWidth: { xs: '100%', sm: '100px' },
                        borderRadius: '8px',
                        fontWeight: 500,
                        textTransform: 'none',
                        fontSize: '0.9375rem',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                            backgroundColor: '#fff5f5',
                            borderColor: '#dc3545',
                            borderWidth: '1.5px',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.15)'
                        }
                    }}
                >
                    Cancel
                </Button>
                <Button 
                    onClick={handleAllocateLeaves} 
                    variant="contained"
                    sx={{
                        minWidth: { xs: '100%', sm: '150px' },
                        backgroundColor: '#dc3545',
                        color: '#ffffff',
                        fontWeight: 600,
                        px: 4,
                        py: 1.25,
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontSize: '0.9375rem',
                        boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                            backgroundColor: '#c82333',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.4)'
                        },
                        '&:active': {
                            transform: 'translateY(0)',
                            boxShadow: '0 2px 6px rgba(220, 53, 69, 0.3)'
                        }
                    }}
                >
                    Allocate Leaves
                </Button>
            </DialogActions>
        </Dialog>

        {/* Bulk Allocate Leaves Dialog */}
        <Dialog 
            open={showBulkAllocateDialog} 
            onClose={() => setShowBulkAllocateDialog(false)} 
            maxWidth="lg" 
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                }
            }}
        >
            {/* Header */}
            <DialogTitle sx={{ 
                backgroundColor: '#dc3545', 
                color: '#ffffff', 
                fontWeight: 'bold',
                fontSize: '1.5rem',
                py: 2.5,
                px: 3,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Box>Bulk Allocate Leave Entitlements</Box>
                <FormControl sx={{ minWidth: 120, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '4px' }}>
                    <Select 
                        value={bulkAllocateForm.year} 
                        onChange={(e) => setBulkAllocateForm({ ...bulkAllocateForm, year: e.target.value })}
                        sx={{
                            color: '#ffffff',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.5)'
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.8)'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#ffffff'
                            },
                            '& .MuiSvgIcon-root': {
                                color: '#ffffff'
                            }
                        }}
                        MenuProps={{
                            PaperProps: {
                                sx: {
                                    backgroundColor: '#ffffff',
                                    '& .MuiMenuItem-root': {
                                        color: '#333'
                                    }
                                }
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
                backgroundColor: '#f8f9fa',
                px: 3,
                py: 3
            }}>
                <Grid container spacing={3}>
                    {/* Left Column - Employee Selection */}
                    <Grid item xs={12} md={6}>
                        <Card sx={{ 
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5 }}>
                                {/* Header with Count */}
                                <Box sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    mb: 2,
                                    pb: 2,
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    <Typography variant="h6" sx={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        Select Employees
                                    </Typography>
                                    <Chip 
                                        label={`${bulkAllocateForm.employeeIds?.length || 0} selected`}
                                        sx={{
                                            backgroundColor: '#dc3545',
                                            color: '#ffffff',
                                            fontWeight: 'bold',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </Box>
                                
                                {/* Action Buttons */}
                                <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                                    <Button 
                                        size="small" 
                                        onClick={handleSelectAllEmployees} 
                                        variant="outlined"
                                        sx={{ 
                                            flex: 1,
                                            color: '#dc3545',
                                            borderColor: '#dc3545',
                                            fontSize: '0.8rem',
                                            py: 0.75,
                                            '&:hover': {
                                                backgroundColor: '#dc3545',
                                                color: '#ffffff',
                                                borderColor: '#dc3545'
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
                                            flex: 1,
                                            color: '#dc3545',
                                            borderColor: '#dc3545',
                                            fontSize: '0.8rem',
                                            py: 0.75,
                                            '&:hover': {
                                                backgroundColor: '#dc3545',
                                                color: '#ffffff',
                                                borderColor: '#dc3545'
                                            }
                                        }}
                                    >
                                        Deselect All
                                    </Button>
                                </Box>

                                {/* Employee List */}
                                <Paper sx={{ 
                                    flex: 1,
                                    maxHeight: 450, 
                                    overflow: 'auto', 
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '6px',
                                    backgroundColor: '#ffffff'
                                }}>
                                    <List dense sx={{ p: 0 }}>
                                        {employees.map((emp) => (
                                            <ListItem 
                                                key={emp._id} 
                                                disablePadding
                                                sx={{
                                                    borderBottom: '1px solid #f0f0f0',
                                                    '&:hover': {
                                                        backgroundColor: '#fff5f5'
                                                    },
                                                    '&:last-child': {
                                                        borderBottom: 'none'
                                                    }
                                                }}
                                            >
                                                <ListItemButton 
                                                    onClick={() => handleToggleEmployeeSelection(emp._id)}
                                                    sx={{
                                                        py: 1.5,
                                                        px: 2,
                                                        '&:hover': {
                                                            backgroundColor: '#fff5f5'
                                                        }
                                                    }}
                                                >
                                                    <ListItemIcon sx={{ minWidth: 45 }}>
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
                                                            <Typography sx={{ fontWeight: '500', color: '#333', fontSize: '0.95rem' }}>
                                                                {emp.fullName}
                                                            </Typography>
                                                        }
                                                        secondary={
                                                            <Typography sx={{ fontSize: '0.8rem', color: '#666', mt: 0.5 }}>
                                                                {emp.employeeCode + (emp.department ? ` • ${emp.department}` : '')}
                                                            </Typography>
                                                        }
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Paper>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Right Column - Leave Entitlements */}
                    <Grid item xs={12} md={6}>
                        <Card sx={{ 
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5 }}>
                                <Typography variant="h6" sx={{ 
                                    mb: 3, 
                                    color: '#dc3545', 
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    pb: 2,
                                    borderBottom: '2px solid #e0e0e0'
                                }}>
                                    Leave Entitlements
                                </Typography>
                                
                                {/* Leave Input Fields */}
                                <Box sx={{ mb: 2, flex: 1 }}>
                                    <TextField 
                                        fullWidth 
                                        label="Sick Leave Entitlement" 
                                        type="number" 
                                        value={bulkAllocateForm.sickLeaveEntitlement} 
                                        onChange={(e) => setBulkAllocateForm({ ...bulkAllocateForm, sickLeaveEntitlement: parseInt(e.target.value) || 0 })} 
                                        inputProps={{ min: 0, max: 365 }} 
                                        sx={{
                                            mb: 2,
                                            '& .MuiOutlinedInput-root': {
                                                backgroundColor: '#ffffff',
                                                '&:hover fieldset': {
                                                    borderColor: '#dc3545'
                                                },
                                                '&.Mui-focused fieldset': {
                                                    borderColor: '#dc3545'
                                                }
                                            },
                                            '& .MuiInputLabel-root.Mui-focused': {
                                                color: '#dc3545'
                                            }
                                        }}
                                    />
                                    <TextField 
                                        fullWidth 
                                        label="Casual Leave Entitlement" 
                                        type="number" 
                                        value={bulkAllocateForm.casualLeaveEntitlement} 
                                        onChange={(e) => setBulkAllocateForm({ ...bulkAllocateForm, casualLeaveEntitlement: parseInt(e.target.value) || 0 })} 
                                        inputProps={{ min: 0, max: 365 }} 
                                        sx={{
                                            mb: 2,
                                            '& .MuiOutlinedInput-root': {
                                                backgroundColor: '#ffffff',
                                                '&:hover fieldset': {
                                                    borderColor: '#dc3545'
                                                },
                                                '&.Mui-focused fieldset': {
                                                    borderColor: '#dc3545'
                                                }
                                            },
                                            '& .MuiInputLabel-root.Mui-focused': {
                                                color: '#dc3545'
                                            }
                                        }}
                                    />
                                    <TextField 
                                        fullWidth 
                                        label="Planned Leave Entitlement" 
                                        type="number" 
                                        value={bulkAllocateForm.paidLeaveEntitlement} 
                                        onChange={(e) => setBulkAllocateForm({ ...bulkAllocateForm, paidLeaveEntitlement: parseInt(e.target.value) || 0 })} 
                                        inputProps={{ min: 0, max: 365 }} 
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                backgroundColor: '#ffffff',
                                                '&:hover fieldset': {
                                                    borderColor: '#dc3545'
                                                },
                                                '&.Mui-focused fieldset': {
                                                    borderColor: '#dc3545'
                                                }
                                            },
                                            '& .MuiInputLabel-root.Mui-focused': {
                                                color: '#dc3545'
                                            }
                                        }}
                                    />
                                </Box>

                                {/* Summary Box */}
                                <Box sx={{ 
                                    p: 2.5, 
                                    backgroundColor: '#fff5f5', 
                                    borderRadius: '8px',
                                    border: '2px solid #dc3545',
                                    mt: 'auto'
                                }}>
                                    <Box sx={{ mb: 1.5 }}>
                                        <Typography variant="body2" sx={{ color: '#666', mb: 0.5, fontSize: '0.875rem' }}>
                                            Total Entitlement per Employee
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1.25rem' }}>
                                            {bulkAllocateForm.sickLeaveEntitlement + bulkAllocateForm.casualLeaveEntitlement + bulkAllocateForm.paidLeaveEntitlement} days
                                        </Typography>
                                    </Box>
                                    {bulkAllocateForm.employeeIds?.length > 0 && (
                                        <Box>
                                            <Typography variant="body2" sx={{ color: '#666', mb: 0.5, fontSize: '0.875rem' }}>
                                                Total Employees Selected
                                            </Typography>
                                            <Typography variant="h6" sx={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1.25rem' }}>
                                                {bulkAllocateForm.employeeIds.length} employee{bulkAllocateForm.employeeIds.length !== 1 ? 's' : ''}
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </DialogContent>

            {/* Footer Actions */}
            <DialogActions sx={{ 
                px: 3, 
                pb: 3,
                pt: 2.5,
                backgroundColor: '#ffffff',
                borderTop: '2px solid #e0e0e0',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Box>
                    {bulkAllocateForm.employeeIds?.length > 0 && (
                        <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                            Ready to allocate to {bulkAllocateForm.employeeIds.length} employee{bulkAllocateForm.employeeIds.length !== 1 ? 's' : ''}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                        onClick={() => {
                            setShowBulkAllocateDialog(false);
                            setBulkAllocateForm({ ...bulkAllocateForm, employeeIds: [] });
                        }}
                        sx={{
                            color: '#dc3545',
                            borderColor: '#dc3545',
                            px: 3,
                            minWidth: '100px',
                            '&:hover': {
                                backgroundColor: '#fff5f5',
                                borderColor: '#dc3545'
                            }
                        }}
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleBulkAllocateLeaves} 
                        variant="contained"
                        disabled={!bulkAllocateForm.employeeIds || bulkAllocateForm.employeeIds.length === 0}
                        sx={{
                            backgroundColor: '#dc3545',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            px: 4,
                            minWidth: '200px',
                            '&:hover': {
                                backgroundColor: '#c82333'
                            },
                            '&.Mui-disabled': {
                                backgroundColor: '#cccccc',
                                color: '#666666'
                            }
                        }}
                    >
                        Bulk Allocate ({bulkAllocateForm.employeeIds?.length || 0} employees)
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