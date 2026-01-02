// src/components/AdminLeaveForm.jsx
import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid,
    Select, MenuItem, InputLabel, FormControl, CircularProgress, Stack, Box, Typography,
    Autocomplete
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
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
                    leaveDates: request.leaveDates?.map(d => {
                        // Parse date - backend sends as Date object or ISO string
                        // Frontend DatePicker expects Date object
                        return d instanceof Date ? d : (d ? new Date(d) : null);
                    }).filter(d => d !== null) || [null],
                    alternateDate: request.alternateDate ? (request.alternateDate instanceof Date ? request.alternateDate : new Date(request.alternateDate)) : null,
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
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                } 
            }}
        >
            {/* Header with Red Accent */}
            <DialogTitle sx={{ 
                backgroundColor: '#ffffff',
                color: '#212121', 
                fontWeight: 600,
                fontSize: '1.25rem',
                py: 2.5,
                px: 3,
                borderBottom: '2px solid #dc3545',
                position: 'relative'
            }}>
                {isEditing ? 'Edit Leave Request' : 'New Leave Request'}
            </DialogTitle>

            <DialogContent sx={{ 
                backgroundColor: '#ffffff',
                p: 3
            }}>
                <Stack spacing={3}>
                    {/* Employee Selection */}
                    <Autocomplete
                        options={employees}
                        getOptionLabel={(option) => `${option.fullName} (${option.employeeCode})`}
                        value={selectedEmployee}
                        onChange={(event, newValue) => {
                            setFormData(prev => ({ ...prev, employee: newValue?._id || '' }));
                        }}
                        disabled={!employees.length}
                        loading={!employees.length}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Employee"
                                required
                                variant="outlined"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: '#ffffff',
                                        '& fieldset': {
                                            borderColor: '#d0d0d0'
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
                    />

                    {/* Request Type & Leave Type */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required>
                                <InputLabel id="request-type-label" sx={{ '&.Mui-focused': { color: '#dc3545' } }}>Request Type</InputLabel>
                                <Select 
                                    name="requestType" 
                                    labelId="request-type-label"
                                    label="Request Type" 
                                    value={formData.requestType} 
                                    onChange={handleChange}
                                    sx={{
                                        backgroundColor: '#ffffff',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#d0d0d0'
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
                                    <MenuItem value="Planned">Planned Leave</MenuItem>
                                    <MenuItem value="Sick">Sick Leave</MenuItem>
                                    <MenuItem value="Casual">Casual Leave</MenuItem>
                                    <MenuItem value="Loss of Pay">LOP Loss of Pay</MenuItem>
                                    <MenuItem value="Compensatory">Compensatory</MenuItem>
                                    <MenuItem value="Backdated Leave">Backdated Leave</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required>
                                <InputLabel id="leave-type-label" sx={{ '&.Mui-focused': { color: '#dc3545' } }}>Leave Type</InputLabel>
                                <Select 
                                    name="leaveType" 
                                    labelId="leave-type-label"
                                    label="Leave Type" 
                                    value={formData.leaveType} 
                                    onChange={handleChange}
                                    sx={{
                                        backgroundColor: '#ffffff',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#d0d0d0'
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
                                    <MenuItem value="Full Day">Full Day</MenuItem>
                                    <MenuItem value="Half Day - First Half">Half Day - First Half</MenuItem>
                                    <MenuItem value="Half Day - Second Half">Half Day - Second Half</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    {/* Leave Date */}
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker 
                            label="Leave Date" 
                            value={formData.leaveDates[0]} 
                            onChange={handleDateChange}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    required: true,
                                    variant: "outlined",
                                    InputProps: {
                                        endAdornment: (
                                            <CalendarTodayIcon 
                                                sx={{ 
                                                    color: '#dc3545',
                                                    mr: 1
                                                }} 
                                            />
                                        )
                                    },
                                    sx: {
                                        backgroundColor: '#ffffff',
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: '#d0d0d0'
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
                                    }
                                }
                            }}
                        />
                    </LocalizationProvider>

                    {/* Alternate Date for Compensatory */}
                    {formData.requestType === 'Compensatory' && (
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker 
                                label="Alternate Date" 
                                value={formData.alternateDate} 
                                onChange={handleAlternateDateChange}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        required: true,
                                        variant: "outlined",
                                        InputProps: {
                                            endAdornment: (
                                                <CalendarTodayIcon 
                                                    sx={{ 
                                                        color: '#757575',
                                                        mr: 1
                                                    }} 
                                                />
                                            )
                                        },
                                        sx: {
                                            backgroundColor: '#ffffff',
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: '#d0d0d0'
                                                },
                                                '&:hover fieldset': {
                                                    borderColor: '#9e9e9e'
                                                },
                                                '&.Mui-focused fieldset': {
                                                    borderColor: '#616161'
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </LocalizationProvider>
                    )}

                    {/* Reason */}
                    <TextField 
                        name="reason" 
                        label="Reason" 
                        multiline 
                        rows={3} 
                        value={formData.reason} 
                        onChange={handleChange} 
                        fullWidth 
                        required
                        placeholder="Enter reason for leave"
                        variant="outlined"
                        sx={{
                            backgroundColor: '#ffffff',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: '#d0d0d0'
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

                    {/* Status */}
                    <FormControl fullWidth required>
                        <InputLabel id="status-label" sx={{ '&.Mui-focused': { color: '#dc3545' } }}>Status</InputLabel>
                        <Select 
                            name="status" 
                            labelId="status-label"
                            label="Status" 
                            value={formData.status} 
                            onChange={handleChange}
                            sx={{
                                backgroundColor: '#ffffff',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#d0d0d0'
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
                            <MenuItem value="Pending">Pending</MenuItem>
                            <MenuItem value="Approved">Approved</MenuItem>
                            <MenuItem value="Rejected">Rejected</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>

            {/* Simple Footer Actions */}
            <DialogActions sx={{ 
                p: 3,
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e0e0e0',
                gap: 2
            }}>
                <Button 
                    onClick={onClose}
                    variant="outlined"
                    sx={{
                        color: '#424242',
                        borderColor: '#d0d0d0',
                        px: 3,
                        py: 1,
                        textTransform: 'none',
                        fontWeight: 500,
                        '&:hover': {
                            borderColor: '#dc3545',
                            color: '#dc3545',
                            backgroundColor: '#fff5f5'
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
                        backgroundColor: '#dc3545',
                        color: '#ffffff',
                        px: 3,
                        py: 1,
                        textTransform: 'none',
                        fontWeight: 500,
                        '&:hover': {
                            backgroundColor: '#c82333'
                        },
                        '&.Mui-disabled': {
                            backgroundColor: '#e0e0e0',
                            color: '#9e9e9e'
                        }
                    }}
                >
                    {isSaving ? <CircularProgress size={20} sx={{ color: '#ffffff' }} /> : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AdminLeaveForm;