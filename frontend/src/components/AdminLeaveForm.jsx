// src/components/AdminLeaveForm.jsx
import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid,
    Select, MenuItem, InputLabel, FormControl, CircularProgress, Stack, Divider, Box, Typography,
    Autocomplete, IconButton, Avatar
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CloseIcon from '@mui/icons-material/Close'; // UI unified with Employee Leave Modal

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
                    width: '580px',
                    maxHeight: '80vh',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden' // Keep overflow hidden on the container
                } 
            }}
        >
            {/* redesigned header UI – neutral theme */}
            <DialogTitle sx={{ 
                backgroundColor: '#FFFFFF',
                borderBottom: '1px solid #E5E7EB',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <Box>
                    <Typography variant="h6" sx={{ color: '#111827', fontWeight: 600, fontSize: '1.125rem' }}>
                        {isEditing ? 'Edit Leave Request' : 'Log Leave Request'}
                    </Typography>
                    <Typography sx={{ color: '#6B7280', fontWeight: 400, fontSize: '0.875rem', mt: '4px' }}>
                        Log a new leave of absence for an employee.
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: '#6B7280',
                        '&:hover': {
                            backgroundColor: '#F3F4F6',
                            color: '#111827',
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ 
                backgroundColor: '#ffffff', // UI unified with Employee Leave Modal
                p: 3, // UI unified with Employee Leave Modal - 24px padding
                maxHeight: 'calc(90vh - 200px)', // UI unified with Employee Leave Modal - internal scroll
                overflow: 'auto',
                '&.MuiDialogContent-root': {
                    paddingTop: 3
                }
            }}>
                <Stack spacing={3}> {/* UI unified with Employee Leave Modal - consistent spacing */}
                    {/* Employee Dropdown with Search - Admin only field */}
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
                        PaperComponent={({ children }) => (
                            <Box sx={{
                                // redesigned dropdown UI – neutral theme
                                backgroundColor: '#FFFFFF',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                border: '1px solid #E5E7EB',
                                marginTop: '8px',
                            }}>{children}</Box>
                        )}
                        renderOption={(props, option) => (
                            <Box component="li" sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props}>
                                <Avatar sx={{ mr: 2, bgcolor: '#E5E7EB', color: '#4B5563' }}>
                                    {option.fullName.charAt(0)}
                                </Avatar>
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {option.fullName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        (#{option.employeeCode})
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Employee"
                                required
                                aria-required="true"
                                sx={{
                                    // redesigned form field UI – neutral theme
                                    '& .MuiInputLabel-root': {
                                        color: '#6B7280',
                                        fontSize: '0.875rem',
                                        '&.Mui-focused': {
                                            color: '#111827',
                                        },
                                    },
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: '#FFFFFF',
                                        borderRadius: '8px',
                                        '& fieldset': {
                                            borderColor: '#D1D5DB',
                                        },
                                        '&:hover fieldset': {
                                            borderColor: '#9CA3AF',
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: '#111827',
                                            borderWidth: '1px',
                                        },
                                    },
                                }}
                            />
                        )}
                    />

                    {/* Leave Category & Leave Type - Side by Side */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required sx={{
                                // redesigned form field UI – neutral theme
                                '& .MuiInputLabel-root': {
                                    color: '#6B7280',
                                    fontSize: '0.875rem',
                                    '&.Mui-focused': {
                                        color: '#111827',
                                    },
                                },
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: '8px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#D1D5DB',
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#9CA3AF',
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#111827',
                                        borderWidth: '1px',
                                    },
                                },
                            }}>
                                <InputLabel>Leave Category</InputLabel>
                                <Select 
                                    name="requestType" 
                                    label="Leave Category" 
                                    value={formData.requestType} 
                                    onChange={handleChange}
                                    aria-label="Request type"
                                    aria-required="true"
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                // redesigned dropdown UI – neutral theme
                                                backgroundColor: '#FFFFFF',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                                border: '1px solid #E5E7EB',
                                                marginTop: '8px',
                                            },
                                        },
                                    }}
                                >
                                    <MenuItem value="Planned">Planned Leave</MenuItem>
                                    <MenuItem value="Sick">Sick Leave</MenuItem>
                                    <MenuItem value="Loss of Pay">LOP Loss of Pay</MenuItem>
                                    <MenuItem value="Compensatory">Compensatory</MenuItem>
                                    <MenuItem value="Backdated Leave">Backdated Leave</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required sx={{
                                // redesigned form field UI – neutral theme
                                '& .MuiInputLabel-root': {
                                    color: '#6B7280',
                                    fontSize: '0.875rem',
                                    '&.Mui-focused': {
                                        color: '#111827',
                                    },
                                },
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: '8px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#D1D5DB',
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#9CA3AF',
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#111827',
                                        borderWidth: '1px',
                                    },
                                },
                            }}>
                                <InputLabel>Leave Type</InputLabel>
                                <Select 
                                    name="leaveType" 
                                    label="Leave Type" 
                                    value={formData.leaveType} 
                                    onChange={handleChange}
                                    aria-label="Leave type"
                                    aria-required="true"
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                // redesigned dropdown UI – neutral theme
                                                backgroundColor: '#FFFFFF',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                                border: '1px solid #E5E7EB',
                                                marginTop: '8px',
                                            },
                                        },
                                    }}
                                >
                                    <MenuItem value="Full Day">Full Day</MenuItem>
                                    <MenuItem value="Half Day - First Half">Half Day - First Half</MenuItem>
                                    <MenuItem value="Half Day - Second Half">Half Day - Second Half</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                    {/* Start Date */}
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker 
                            label="Start Date" 
                            value={formData.leaveDates[0]} 
                            onChange={handleDateChange}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    required: true,
                                    placeholder: 'Select Date',
                                    'aria-label': 'Leave date',
                                    'aria-required': 'true',
                                    sx: {
                                        // redesigned form field UI – neutral theme
                                        '& .MuiInputLabel-root': {
                                            color: '#6B7280',
                                            fontSize: '0.875rem',
                                            '&.Mui-focused': {
                                                color: '#111827',
                                            },
                                        },
                                        '& .MuiOutlinedInput-root': {
                                            backgroundColor: '#FFFFFF',
                                            borderRadius: '8px',
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#D1D5DB',
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#9CA3AF',
                                            },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#111827',
                                                borderWidth: '1px',
                                            },
                                        },
                                    }
                                }
                            }}
                        />
                    </LocalizationProvider>

                    {/* End Date (optional) - UI unified with Employee Leave Modal */}
                    {formData.requestType !== 'Compensatory' && (
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker 
                                label="End Date (optional)" 
                                value={formData.leaveDates[1] || null} 
                                onChange={(date) => {
                                    setFormData(prev => ({ 
                                        ...prev, 
                                        leaveDates: date ? [prev.leaveDates[0], date] : [prev.leaveDates[0]]
                                    }));
                                }}
                                minDate={formData.leaveDates[0]}
                                disabled={!formData.leaveDates[0]}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        placeholder: 'Select Date',
                                        sx: {
                                            // redesigned form field UI – neutral theme
                                            '& .MuiInputLabel-root': {
                                                color: '#6B7280',
                                                fontSize: '0.875rem',
                                                '&.Mui-focused': {
                                                    color: '#111827',
                                                },
                                            },
                                            '& .MuiOutlinedInput-root': {
                                                backgroundColor: '#FFFFFF',
                                                borderRadius: '8px',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#D1D5DB',
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#9CA3AF',
                                                },
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#111827',
                                                    borderWidth: '1px',
                                                },
                                            },
                                        }
                                    }
                                }}
                            />
                        </LocalizationProvider>
                    )}

                    {/* Alternate Date for Compensatory Leave */}
                    {formData.requestType === 'Compensatory' && (
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker 
                                label="Alternate Working Date" 
                                value={formData.alternateDate} 
                                onChange={handleAlternateDateChange}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        required: true,
                                        placeholder: 'Select Date',
                                        sx: {
                                            // redesigned form field UI – neutral theme
                                            '& .MuiInputLabel-root': {
                                                color: '#6B7280',
                                                fontSize: '0.875rem',
                                                '&.Mui-focused': {
                                                    color: '#111827',
                                                },
                                            },
                                            '& .MuiOutlinedInput-root': {
                                                backgroundColor: '#FFFFFF',
                                                borderRadius: '8px',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#D1D5DB',
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#9CA3AF',
                                                },
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#111827',
                                                    borderWidth: '1px',
                                                },
                                            },
                                        }
                                    }
                                }}
                            />
                        </LocalizationProvider>
                    )}
                    {/* Reason Textarea */}
                    <TextField 
                        name="reason" 
                        label="Reason" 
                        multiline 
                        rows={4} // UI unified with Employee Leave Modal - consistent rows
                        value={formData.reason} 
                        onChange={handleChange} 
                        fullWidth 
                        required
                        placeholder="Enter reason for leave"
                        aria-label="Reason for leave"
                        aria-required="true"
                        sx={{
                            // redesigned form field UI – neutral theme
                            '& .MuiInputLabel-root': {
                                color: '#6B7280',
                                fontSize: '0.875rem',
                                '&.Mui-focused': {
                                    color: '#111827',
                                },
                            },
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: '#FFFFFF',
                                borderRadius: '8px',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#D1D5DB',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#9CA3AF',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#111827',
                                    borderWidth: '1px',
                                },
                            },
                        }}
                    />
                    {/* Status Dropdown - Admin only field */}
                    <FormControl fullWidth required sx={{
                        // redesigned form field UI – neutral theme
                        '& .MuiInputLabel-root': {
                            color: '#6B7280',
                            fontSize: '0.875rem',
                            '&.Mui-focused': {
                                color: '#111827',
                            },
                        },
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: '#FFFFFF',
                            borderRadius: '8px',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#D1D5DB',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#9CA3AF',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#111827',
                                borderWidth: '1px',
                            },
                        },
                    }}>
                        <InputLabel>Status</InputLabel>
                        <Select 
                            name="status" 
                            label="Status" 
                            value={formData.status} 
                            onChange={handleChange}
                            aria-label="Leave request status"
                            aria-required="true"
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        // redesigned dropdown UI – neutral theme
                                        backgroundColor: '#FFFFFF',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                        border: '1px solid #E5E7EB',
                                        marginTop: '8px',
                                    },
                                },
                            }}
                        >
                            <MenuItem 
                                value="Pending"
                                sx={{
                                    // redesigned dropdown item UI – neutral theme
                                    '&:hover': {
                                        backgroundColor: '#F9FAFB'
                                    },
                                    '&.Mui-selected': {
                                        backgroundColor: '#F3F4F6',
                                        '&:hover': {
                                            backgroundColor: '#F9FAFB'
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
                                            backgroundColor: '#9CA3AF' 
                                        }} 
                                    />
                                    Pending
                                </Box>
                            </MenuItem>
                            <MenuItem 
                                value="Approved"
                                sx={{
                                    // redesigned dropdown item UI – neutral theme
                                    '&:hover': {
                                        backgroundColor: '#F9FAFB'
                                    },
                                    '&.Mui-selected': {
                                        backgroundColor: '#F3F4F6',
                                        '&:hover': {
                                            backgroundColor: '#F9FAFB'
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
                                            backgroundColor: '#6B7280' 
                                        }} 
                                    />
                                    Approved
                                </Box>
                            </MenuItem>
                            <MenuItem 
                                value="Rejected"
                                sx={{
                                    // redesigned dropdown item UI – neutral theme
                                    '&:hover': {
                                        backgroundColor: '#F9FAFB'
                                    },
                                    '&.Mui-selected': {
                                        backgroundColor: '#F3F4F6',
                                        '&:hover': {
                                            backgroundColor: '#F9FAFB'
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
                                            backgroundColor: '#4B5563' 
                                        }} 
                                    />
                                    Rejected
                                </Box>
                            </MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>

            {/* redesigned footer UI – neutral theme */}
            <DialogActions sx={{ 
                padding: '16px 24px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #E5E7EB',
            }}>
                <Button 
                    onClick={onClose}
                    variant="outlined"
                    disabled={isSaving}
                    sx={{
                        // redesigned secondary button UI – neutral theme
                        borderColor: '#D1D5DB',
                        color: '#374151',
                        fontWeight: 600,
                        borderRadius: '8px',
                        textTransform: 'none',
                        '&:hover': {
                            borderColor: '#9CA3AF',
                            backgroundColor: '#F9FAFB',
                        },
                    }}
                >
                    Cancel
                </Button>
                <Button 
                    onClick={handleSaveClick} 
                    variant="contained" 
                    disabled={isSaving} 
                    sx={{ 
                        // redesigned primary button UI – neutral theme
                        backgroundColor: '#111827',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        borderRadius: '8px',
                        textTransform: 'none',
                        boxShadow: 'none',
                        '&:hover': {
                            backgroundColor: '#1F2937',
                        },
                        '&:disabled': {
                            backgroundColor: '#D1D5DB',
                            color: '#9CA3AF',
                        }
                    }}
                >
                    {isSaving ? <CircularProgress size={24} sx={{ color: '#FFFFFF' }} /> : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AdminLeaveForm;