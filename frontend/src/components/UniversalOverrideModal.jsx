/**
 * Global form-based Universal Override modal.
 * Apply override to All Employees or selected employees, for a single date or date range.
 * Uses POST /api/admin/attendance/bulk-override.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Box,
    Chip,
    Divider,
} from '@mui/material';
import api from '../api/axios';
import { SkeletonBox } from './SkeletonLoaders';
import { filterActiveEmployees } from '../utils/employeeFilterUtils';
import { getISTDateString } from '../utils/istTime';

const UniversalOverrideModal = ({ open, onClose, employees: employeesProp, onSuccess }) => {
    const [allEmployees, setAllEmployees] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [useRange, setUseRange] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [overrideType, setOverrideType] = useState('fullday');
    const [overrideNote, setOverrideNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [todayIST] = useState(() => getISTDateString());

    useEffect(() => {
        const list = Array.isArray(employeesProp) ? employeesProp : [];
        setEmployees(filterActiveEmployees(list));
    }, [employeesProp]);

    useEffect(() => {
        if (open) {
            const today = getISTDateString();
            setAllEmployees(true);
            setSelectedIds([]);
            setUseRange(false);
            setStartDate(today);
            setEndDate(today);
            setOverrideType('fullday');
            setOverrideNote('');
            setError('');
            setConfirmOpen(false);
        }
    }, [open]);

    const dayCount = useMemo(() => {
        if (!startDate || !useRange || !endDate || startDate > endDate) return 1;
        const start = new Date(startDate);
        const end = new Date(endDate <= todayIST ? endDate : todayIST);
        return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }, [startDate, endDate, useRange, todayIST]);

    const MAX_DAYS = 31;
    const hasEmployeeScope = allEmployees || selectedIds.length > 0;
    const hasDate = !!startDate?.trim() && startDate <= todayIST;
    const hasDateRange = !useRange || (!!startDate?.trim() && !!endDate?.trim() && startDate <= endDate);
    const hasNote = (overrideNote || '').trim().length > 0;
    const isValid = hasEmployeeScope && hasDate && hasDateRange && hasNote && dayCount <= MAX_DAYS;

    const handleClose = () => {
        if (!isSubmitting) {
            setConfirmOpen(false);
            onClose();
        }
    };

    const handleApplyClick = () => {
        if (!isValid) return;
        setError('');
        setConfirmOpen(true);
    };

    const handleConfirmApply = async () => {
        if (!isValid) return;
        const note = overrideNote.trim();
        const start = startDate.trim();
        const end = useRange ? (endDate || start).trim() : start;

        setIsSubmitting(true);
        setError('');
        try {
            const { data } = await api.post('/admin/attendance/bulk-override', {
                employeeScope: allEmployees ? 'all' : selectedIds,
                startDate: start,
                endDate: useRange ? end : undefined,
                overrideType,
                overrideNote: note,
            });
            setConfirmOpen(false);
            if (onSuccess) await onSuccess(data);
            handleClose();
        } catch (err) {
            const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to apply bulk override.';
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmMessage = allEmployees
        ? `This will override attendance for ALL employees from ${startDate} to ${useRange ? endDate : startDate}.`
        : `This will override attendance for ${selectedIds.length} selected employee(s) from ${startDate} to ${useRange ? endDate : startDate}.`;

    const getOverrideTypeLabel = (type) => {
        switch (type) {
            case 'fullday': return 'Full Day Present';
            case 'halfday': return 'Half Day';
            case 'holiday': return 'Holiday';
            case 'leave': return 'Leave';
            default: return type;
        }
    };

    const getOverrideTypeColor = (type) => {
        switch (type) {
            case 'fullday': return 'success';
            case 'halfday': return 'warning';
            case 'holiday': return 'info';
            case 'leave': return 'secondary';
            default: return 'default';
        }
    };

    if (!open) return null;

    return (
        <>
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ pb: 1 }}>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                        Bulk Attendance Override
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Apply attendance override to multiple employees and dates
                    </Typography>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 3 }}>
                    <Alert severity="info" sx={{ mb: 3 }}>
                        Override attendance records for selected employees and date range. Existing records will be updated with the override.
                    </Alert>

                    {/* Employee Selection */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
                            Employee Scope
                        </Typography>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={allEmployees}
                                    onChange={(e) => {
                                        setAllEmployees(e.target.checked);
                                        if (e.target.checked) setSelectedIds([]);
                                    }}
                                />
                            }
                            label={
                                <Box>
                                    <Typography variant="body2">All Active Employees</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Apply to all non-admin active employees
                                    </Typography>
                                </Box>
                            }
                        />

                        {!allEmployees && (
                            <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                                <InputLabel>Select employees</InputLabel>
                                <Select
                                    multiple
                                    value={selectedIds}
                                    onChange={(e) => setSelectedIds(e.target.value)}
                                    label="Select employees"
                                    renderValue={(ids) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {ids.length > 0 ? (
                                                <Chip label={`${ids.length} selected`} size="small" />
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">None</Typography>
                                            )}
                                        </Box>
                                    )}
                                >
                                    {employees.map((emp) => (
                                        <MenuItem key={emp._id} value={emp._id}>
                                            {emp.fullName} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Date Selection */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
                            Date Range
                        </Typography>
                        <FormControlLabel
                            control={<Checkbox checked={useRange} onChange={(e) => setUseRange(e.target.checked)} />}
                            label={
                                <Box>
                                    <Typography variant="body2">Use date range</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Apply to multiple consecutive dates
                                    </Typography>
                                </Box>
                            }
                            sx={{ mb: 2 }}
                        />

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                            <TextField
                                label="Start date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ max: todayIST }}
                                size="small"
                                fullWidth
                            />
                            {useRange && (
                                <TextField
                                    label="End date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ max: todayIST }}
                                    size="small"
                                    fullWidth
                                    error={!!endDate && startDate > endDate}
                                    helperText={!!endDate && startDate > endDate ? 'End must be ≥ start' : ''}
                                />
                            )}
                        </Box>

                        {useRange && (
                            <Typography 
                                variant="caption" 
                                sx={{ 
                                    color: dayCount > MAX_DAYS ? 'error.main' : 'text.secondary', 
                                    display: 'block' 
                                }}
                            >
                                {dayCount} day{dayCount !== 1 ? 's' : ''} selected
                                {dayCount > MAX_DAYS ? ` — maximum is ${MAX_DAYS} days` : ''}
                            </Typography>
                        )}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Override Type */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
                            Override Type
                        </Typography>
                        <FormControl fullWidth size="small">
                            <InputLabel>Override type</InputLabel>
                            <Select
                                value={overrideType}
                                label="Override type"
                                onChange={(e) => setOverrideType(e.target.value)}
                            >
                                <MenuItem value="fullday">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip label="Full Day" color="success" size="small" />
                                        <Typography variant="body2">Mark as Full Day Present</Typography>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="halfday">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip label="Half Day" color="warning" size="small" />
                                        <Typography variant="body2">Mark as Half Day</Typography>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="holiday">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip label="Holiday" color="info" size="small" />
                                        <Typography variant="body2">Mark as Holiday</Typography>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="leave">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip label="Leave" color="secondary" size="small" />
                                        <Typography variant="body2">Mark as Leave</Typography>
                                    </Box>
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Override Note */}
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
                            Override Reason *
                        </Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            placeholder="e.g. Company declared half day due to election, Special event, Emergency closure"
                            value={overrideNote}
                            onChange={(e) => setOverrideNote(e.target.value)}
                            error={!!error}
                            helperText={error || (!overrideNote.trim() ? 'Override reason is required for audit trail' : '')}
                        />
                    </Box>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={handleClose} variant="outlined" disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApplyClick}
                        variant="contained"
                        color="primary"
                        disabled={!isValid || isSubmitting}
                    >
                        Apply Override
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={confirmOpen} onClose={() => !isSubmitting && setConfirmOpen(false)} maxWidth="sm">
                <DialogTitle>Confirm Bulk Override</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This action will modify attendance records. Please review carefully.
                    </Alert>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        {confirmMessage}
                    </Typography>
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Override Details:
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>Type:</Typography>
                                <Chip 
                                    label={getOverrideTypeLabel(overrideType)} 
                                    color={getOverrideTypeColor(overrideType)} 
                                    size="small" 
                                />
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>Reason:</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {overrideNote}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmApply}
                        variant="contained"
                        color="primary"
                        disabled={isSubmitting}
                        startIcon={isSubmitting ? <SkeletonBox width="20px" height="20px" borderRadius="50%" /> : null}
                    >
                        {isSubmitting ? 'Applying…' : 'Confirm'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default UniversalOverrideModal;
