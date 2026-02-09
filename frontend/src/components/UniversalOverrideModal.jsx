/**
 * Global form-based Universal Override modal.
 * Apply override to All Employees or selected employees, for a single date or date range.
 * Uses POST /api/admin/attendance/bulk-override.
 */
import React, { useState, useEffect } from 'react';
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

    const hasEmployeeScope = allEmployees || selectedIds.length > 0;
    const hasDate = !!startDate?.trim();
    const hasDateRange = !useRange || (!!startDate?.trim() && !!endDate?.trim() && startDate <= endDate);
    const hasNote = (overrideNote || '').trim().length > 0;
    const isValid = hasEmployeeScope && hasDate && hasDateRange && hasNote;

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

    if (!open) return null;

    return (
        <>
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>Override Attendance (Universal)</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Apply override to all or selected employees for a single date or date range. No attendance records are deleted.
                    </Alert>

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
                        label="All Employees (bulk action)"
                        sx={{ mb: 1 }}
                    />
                    {allEmployees && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Override will apply to all active, non-admin employees.
                        </Typography>
                    )}

                    {!allEmployees && (
                        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                            <InputLabel>Select employees</InputLabel>
                            <Select
                                multiple
                                value={selectedIds}
                                onChange={(e) => setSelectedIds(e.target.value)}
                                label="Select employees"
                                renderValue={(ids) => ids.length ? `${ids.length} selected` : 'None'}
                            >
                                {employees.map((emp) => (
                                    <MenuItem key={emp._id} value={emp._id}>
                                        {emp.fullName} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <FormControlLabel
                        control={<Checkbox checked={useRange} onChange={(e) => setUseRange(e.target.checked)} />}
                        label="Use date range"
                        sx={{ mb: 1, mt: 1 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                        <TextField
                            label="Start date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
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
                                size="small"
                                fullWidth
                                error={!!endDate && startDate > endDate}
                                helperText={!!endDate && startDate > endDate ? 'End must be ≥ start' : ''}
                            />
                        )}
                    </Box>

                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Override type</InputLabel>
                        <Select
                            value={overrideType}
                            label="Override type"
                            onChange={(e) => setOverrideType(e.target.value)}
                        >
                            <MenuItem value="fullday">Full Day</MenuItem>
                            <MenuItem value="halfday">Half Day</MenuItem>
                            <MenuItem value="holiday">Holiday</MenuItem>
                        </Select>
                    </FormControl>

                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                        Override note *
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="e.g. Company declared half day due to election"
                        value={overrideNote}
                        onChange={(e) => setOverrideNote(e.target.value)}
                        error={!!error}
                        helperText={error || (!overrideNote.trim() ? 'Override note is required' : '')}
                        sx={{ mt: 0.5 }}
                    />
                </DialogContent>
                <DialogActions>
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

            <Dialog open={confirmOpen} onClose={() => !isSubmitting && setConfirmOpen(false)}>
                <DialogTitle>Confirm bulk override</DialogTitle>
                <DialogContent>
                    <Typography>{confirmMessage}</Typography>
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
