// src/components/AdminLeaveForm.jsx
import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid,
    Select, MenuItem, InputLabel, FormControl, CircularProgress, Stack, Divider, Box, Typography,
    Autocomplete
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

const initialFormState = {
    employee: '',
    requestType: 'Planned',
    leaveType: 'Full Day',
    leaveDates: [null],
    alternateDate: null,
    reason: '',
    status: 'Pending',
};

const AdminLeaveForm = ({ open, onClose, onSave, request, employees, isSaving }) => {
    const [formData, setFormData] = useState(initialFormState);
    const isEditing = !!request;

    useEffect(() => {
        if (open) {
            if (isEditing) {
                setFormData({
                    _id: request._id,
                    employee: request.employee?._id || '',
                    requestType: request.requestType || 'Planned',
                    leaveType: request.leaveType || 'Full Day',
                    leaveDates: request.leaveDates?.map(d => new Date(d)) || [null],
                    alternateDate: request.alternateDate ? new Date(request.alternateDate) : null,
                    reason: request.reason || '',
                    status: request.status || 'Pending',
                });
            } else {
                setFormData(initialFormState);
            }
        }
    }, [request, open, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (date) => {
        setFormData(prev => ({ ...prev, leaveDates: [date] }));
    };

    const handleAlternateDateChange = (date) => {
        setFormData(prev => ({ ...prev, alternateDate: date }));
    };

    const handleSaveClick = () => {
        if (!formData.employee || !formData.reason || !formData.leaveDates[0]) {
            console.error("Validation failed");
            return;
        }
        onSave(formData);
    };

    // Get selected employee object for Autocomplete
    const selectedEmployee = employees.find(emp => emp._id === formData.employee) || null;

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            fullWidth 
            maxWidth="sm" 
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
                    <EditCalendarOutlinedIcon sx={{ color: '#ffffff', fontSize: '1.5rem' }} />
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '1.375rem',
                            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                    >
                        {isEditing ? 'Edit Leave Request' : 'Log New Leave Request'}
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
                    {/* Employee Dropdown with Search */}
                    <Autocomplete
                        options={employees}
                        getOptionLabel={(option) => `${option.fullName} (${option.employeeCode})`}
                        value={selectedEmployee}
                        onChange={(event, newValue) => {
                            setFormData(prev => ({ ...prev, employee: newValue?._id || '' }));
                        }}
                        disabled={!employees.length}
                        loading={!employees.length}
                        aria-label="Select employee"
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Employee"
                                required
                                aria-required="true"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: '8px',
                                        '& fieldset': {
                                            borderColor: selectedEmployee ? '#dc3545' : '#d0d0d0',
                                            borderWidth: selectedEmployee ? '2px' : '1px'
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
                    {/* Request Type & Leave Type - Side by Side */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required>
                                <InputLabel 
                                    id="request-type-label"
                                    sx={{ 
                                        color: '#6c757d', 
                                        '&.Mui-focused': { color: '#dc3545' } 
                                    }}
                                >
                                    Request Type *
                                </InputLabel>
                                <Select 
                                    name="requestType" 
                                    labelId="request-type-label"
                                    label="Request Type *" 
                                    value={formData.requestType} 
                                    onChange={handleChange}
                                    aria-label="Request type"
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
                                    <MenuItem value="Planned">Planned Leave</MenuItem>
                                    <MenuItem value="Sick">Sick Leave</MenuItem>
                                    <MenuItem value="Unpaid">LOP Loss of Pay</MenuItem>
                                    <MenuItem value="Compensatory">Compensatory</MenuItem>
                                    <MenuItem value="Backdated Leave">Backdated Leave</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required>
                                <InputLabel 
                                    id="leave-type-label"
                                    sx={{ 
                                        color: '#6c757d', 
                                        '&.Mui-focused': { color: '#dc3545' } 
                                    }}
                                >
                                    Leave Type *
                                </InputLabel>
                                <Select 
                                    name="leaveType" 
                                    labelId="leave-type-label"
                                    label="Leave Type *" 
                                    value={formData.leaveType} 
                                    onChange={handleChange}
                                    aria-label="Leave type"
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
                                    <MenuItem value="Full Day">Full Day</MenuItem>
                                    <MenuItem value="Half Day - First Half">Half Day - First Half</MenuItem>
                                    <MenuItem value="Half Day - Second Half">Half Day - Second Half</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                    {/* Leave Date with Calendar Icon */}
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker 
                            label="Leave Date *" 
                            value={formData.leaveDates[0]} 
                            onChange={handleDateChange}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    required: true,
                                    placeholder: 'Select Date',
                                    'aria-label': 'Leave date',
                                    'aria-required': 'true',
                                    InputProps: {
                                        endAdornment: (
                                            <CalendarTodayIcon 
                                                sx={{ 
                                                    color: '#dc3545',
                                                    mr: 1,
                                                    pointerEvents: 'none'
                                                }} 
                                            />
                                        )
                                    },
                                    sx: {
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
                                        }
                                    }
                                }
                            }}
                        />
                    </LocalizationProvider>
                    {formData.requestType === 'Compensatory' && (
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker 
                                label="Alternate Date *" 
                                value={formData.alternateDate} 
                                onChange={handleAlternateDateChange}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        required: true,
                                        placeholder: 'Select Date',
                                        InputProps: {
                                            endAdornment: (
                                                <CalendarTodayIcon 
                                                    sx={{ 
                                                        color: '#dc3545',
                                                        mr: 1,
                                                        pointerEvents: 'none'
                                                    }} 
                                                />
                                            )
                                        },
                                        sx: {
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
                                            }
                                        }
                                    }
                                }}
                            />
                        </LocalizationProvider>
                    )}
                    {/* Reason Textarea */}
                    <TextField 
                        name="reason" 
                        label="Reason *" 
                        multiline 
                        rows={3} 
                        value={formData.reason} 
                        onChange={handleChange} 
                        fullWidth 
                        required
                        placeholder="Enter reason for leave"
                        aria-label="Reason for leave"
                        aria-required="true"
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
                            }
                        }}
                    />
                    {/* Status Dropdown with Color Coding */}
                    <FormControl fullWidth required>
                        <InputLabel 
                            id="status-label"
                            sx={{ 
                                color: '#6c757d', 
                                '&.Mui-focused': { color: '#dc3545' } 
                            }}
                        >
                            Status *
                        </InputLabel>
                        <Select 
                            name="status" 
                            labelId="status-label"
                            label="Status *" 
                            value={formData.status} 
                            onChange={handleChange}
                            aria-label="Leave request status"
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
                                }
                            }}
                        >
                            <MenuItem 
                                value="Pending"
                                sx={{
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 193, 7, 0.1)'
                                    },
                                    '&.Mui-selected': {
                                        backgroundColor: 'rgba(255, 193, 7, 0.2)',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 193, 7, 0.3)'
                                        }
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box 
                                        sx={{ 
                                            width: 12, 
                                            height: 12, 
                                            borderRadius: '50%', 
                                            backgroundColor: '#ffc107' 
                                        }} 
                                    />
                                    Pending
                                </Box>
                            </MenuItem>
                            <MenuItem 
                                value="Approved"
                                sx={{
                                    '&:hover': {
                                        backgroundColor: 'rgba(40, 167, 69, 0.1)'
                                    },
                                    '&.Mui-selected': {
                                        backgroundColor: 'rgba(40, 167, 69, 0.2)',
                                        '&:hover': {
                                            backgroundColor: 'rgba(40, 167, 69, 0.3)'
                                        }
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box 
                                        sx={{ 
                                            width: 12, 
                                            height: 12, 
                                            borderRadius: '50%', 
                                            backgroundColor: '#28a745' 
                                        }} 
                                    />
                                    Approved
                                </Box>
                            </MenuItem>
                            <MenuItem 
                                value="Rejected"
                                sx={{
                                    '&:hover': {
                                        backgroundColor: 'rgba(220, 53, 69, 0.1)'
                                    },
                                    '&.Mui-selected': {
                                        backgroundColor: 'rgba(220, 53, 69, 0.2)',
                                        '&:hover': {
                                            backgroundColor: 'rgba(220, 53, 69, 0.3)'
                                        }
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box 
                                        sx={{ 
                                            width: 12, 
                                            height: 12, 
                                            borderRadius: '50%', 
                                            backgroundColor: '#dc3545' 
                                        }} 
                                    />
                                    Rejected
                                </Box>
                            </MenuItem>
                        </Select>
                    </FormControl>
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
                    onClick={onClose}
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
                    onClick={handleSaveClick} 
                    variant="contained" 
                    disabled={isSaving} 
                    sx={{ 
                        minWidth: { xs: '100%', sm: '120px' },
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
                        },
                        '&.Mui-disabled': {
                            backgroundColor: '#cccccc',
                            color: '#666666',
                            boxShadow: 'none',
                            transform: 'none'
                        }
                    }}
                >
                    {isSaving ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AdminLeaveForm;