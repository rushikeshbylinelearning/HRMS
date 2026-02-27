// src/components/TeamsAttendanceNotificationSettings.jsx
/**
 * Teams Attendance Notification Settings — Premium UI Modal
 * Tabs:
 *   0 — Webhook setup
 *   1 — Report content / schedule
 *   2 — Today's report: preview & edit before sending
 *   3 — Upcoming Leaves: list + manual add + send to Teams  ← NEW
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, TextField, Button, Alert, Chip, Divider,
    CircularProgress, IconButton, Stack, Switch,
    Collapse, Tabs, Tab, Paper, Table, TableHead, TableRow,
    TableCell, TableBody, Tooltip, MenuItem, Select,
    FormControl, InputLabel, Autocomplete,
} from '@mui/material';
import {
    Close as CloseIcon,
    Send as SendIcon,
    Delete as DeleteIcon,
    HelpOutline as HelpIcon,
    CheckCircle as CheckIcon,
    NotificationsOff as OffIcon,
    Tune as TuneIcon,
    Link as LinkIcon,
    ExpandMore as ExpandIcon,
    ExpandLess as CollapseIcon,
    Preview as PreviewIcon,
    Edit as EditIcon,
    PersonRemove as PersonRemoveIcon,
    Refresh as RefreshIcon,
    CalendarMonth as CalendarIcon,
    PersonAdd as PersonAddIcon,
    EventNote as EventNoteIcon,
} from '@mui/icons-material';
import api from '../api/axios';

// ─── Design System ────────────────────────────────────────────────────────────
const RED          = '#e53935';
const LIGHT_RED    = 'rgba(229,57,53,0.08)';
const SOFT_WHITE   = '#FFFFFF';
const OFF_WHITE    = '#F7F7F9';
const LIGHT_GRAY   = '#EFEFF1';
const BORDER_GRAY  = '#E5E5E8';
const TEXT_PRIMARY = '#1a1a2e';
const TEXT_SECONDARY = '#6B7280';
const SUCCESS_GREEN  = '#10B981';

const LEAVE_TYPES = [
    { value: '📅 Casual Leave',       label: '📅 Casual Leave' },
    { value: '🤒 Sick Leave',         label: '🤒 Sick Leave' },
    { value: '🏖️ Planned Leave',      label: '🏖️ Planned Leave' },
    { value: '🔄 Compensatory Leave', label: '🔄 Compensatory Leave' },
    { value: '💸 Loss of Pay',        label: '💸 Loss of Pay' },
    { value: '🌗 Half Day (AM)',       label: '🌗 Half Day (AM)' },
    { value: '🌓 Half Day (PM)',       label: '🌓 Half Day (PM)' },
    { value: '📋 Backdated Leave',    label: '📋 Backdated Leave' },
    { value: '🗓️ Year-End Leave',     label: '🗓️ Year-End Leave' },
    { value: '🟡 On Leave',           label: '🟡 On Leave (Other)' },
];

const DEFAULT_CONFIG = {
    showAbsent:        true,
    showOnLeave:       true,
    showPresent:       false,
    showLateEmployees: false,
    showClockInTime:   false,
    showLateMinutes:   false,
    showWorkingHours:  false,
    reportTime:        '11:30',
};

// ─── Shared sub-components ───────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
    <Typography variant="overline" sx={{
        color: RED, fontWeight: 600, fontSize: '0.75rem',
        letterSpacing: 1.5, display: 'block', mb: 2, textTransform: 'uppercase',
    }}>
        {children}
    </Typography>
);

const ToggleRow = ({ label, sublabel, checked, onChange, disabled }) => (
    <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        py: 2, borderBottom: '1px solid', borderColor: BORDER_GRAY,
        '&:last-child': { borderBottom: 'none' },
        opacity: disabled ? 0.5 : 1, transition: 'all 0.2s ease',
        '&:hover': { bgcolor: disabled ? 'transparent' : OFF_WHITE },
    }}>
        <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.4, color: TEXT_PRIMARY, fontSize: '0.875rem' }}>
                {label}
            </Typography>
            {sublabel && (
                <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: '0.75rem', display: 'block', mt: 0.3 }}>
                    {sublabel}
                </Typography>
            )}
        </Box>
        <Switch
            checked={checked} onChange={onChange} disabled={disabled}
            sx={{
                width: 52, height: 28, padding: 0, ml: 2,
                '& .MuiSwitch-switchBase': {
                    padding: 0, margin: '2px', transitionDuration: '300ms',
                    '&.Mui-checked': {
                        transform: 'translateX(24px)', color: '#fff',
                        '& + .MuiSwitch-track': { backgroundColor: RED, opacity: 1, border: 0 },
                    },
                    '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.3 },
                },
                '& .MuiSwitch-thumb': { boxSizing: 'border-box', width: 24, height: 24, boxShadow: '0 2px 4px rgba(0,0,0,0.15)' },
                '& .MuiSwitch-track': { borderRadius: 14, backgroundColor: '#D1D5DB', opacity: 1, transition: 'background-color 300ms ease' },
            }}
        />
    </Box>
);

// ─── Main Modal ───────────────────────────────────────────────────────────────
const TeamsNotificationModal = ({ open, onClose, initialTab = 0 }) => {
    const [tab,        setTab]        = useState(initialTab);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [inputUrl,   setInputUrl]   = useState('');
    const [config,     setConfig]     = useState(DEFAULT_CONFIG);
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [testing,    setTesting]    = useState(false);
    const [error,      setError]      = useState('');
    const [success,    setSuccess]    = useState('');
    const [showGuide,  setShowGuide]  = useState(false);

    // Tab 2 — Today's preview
    const [previewData,    setPreviewData]    = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [editedSections, setEditedSections] = useState(null);
    const [sending,        setSending]        = useState(false);

    // Tab 3 — Upcoming Leaves
    const [upcomingData,      setUpcomingData]      = useState(null);   // { employees, weeksAhead, startDate, endDate }
    const [upcomingLoading,   setUpcomingLoading]   = useState(false);
    const [upcomingEmployees, setUpcomingEmployees] = useState([]);     // editable copy of employees list
    const [weeksAhead,        setWeeksAhead]        = useState(2);
    const [sendingUpcoming,   setSendingUpcoming]   = useState(false);

    // Tab 3 — Add manual entry panel
    const [showAddPanel,     setShowAddPanel]     = useState(false);
    const [allEmployees,     setAllEmployees]     = useState([]);       // full employee roster from API
    const [empListLoading,   setEmpListLoading]   = useState(false);
    const [addEmp,           setAddEmp]           = useState(null);     // selected employee object
    const [addLeaveType,     setAddLeaveType]     = useState('📅 Casual Leave');
    const [addDateFrom,      setAddDateFrom]      = useState('');
    const [addDateTo,        setAddDateTo]        = useState('');

    const isConfigured = Boolean(webhookUrl);
    const clearMessages = () => { setError(''); setSuccess(''); };

    // ── Settings load ────────────────────────────────────────────────────────
    const fetchSettings = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        try {
            const { data } = await api.get('/admin/settings/teams-webhook');
            setWebhookUrl(data.webhookUrl || '');
            setInputUrl(data.webhookUrl || '');
            setConfig({ ...DEFAULT_CONFIG, ...(data.reportConfig || {}) });
        } catch { setError('Failed to load settings.'); }
        finally  { setLoading(false); }
    }, [open]);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);
    useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

    // ── Tab 2: Today's preview ───────────────────────────────────────────────
    const fetchPreviewData = useCallback(async () => {
        setPreviewLoading(true); setError('');
        try {
            const { data } = await api.get('/admin/settings/teams-preview');
            setPreviewData(data);
            setEditedSections({
                present: [...(data.sections?.present || [])],
                late:    [...(data.sections?.late    || [])],
                onLeave: [...(data.sections?.onLeave || [])],
                absent:  [...(data.sections?.absent  || [])],
            });
        } catch { setError('Failed to load preview data.'); }
        finally  { setPreviewLoading(false); }
    }, []);

    useEffect(() => {
        if (tab === 2 && open && !previewData) fetchPreviewData();
    }, [tab, open, previewData, fetchPreviewData]);

    const removeFromPreview = (section, idx) => {
        setEditedSections(prev => ({ ...prev, [section]: prev[section].filter((_, i) => i !== idx) }));
    };

    const handleSendEdited = async () => {
        setSending(true); clearMessages();
        try {
            await api.post('/admin/settings/teams-webhook/send-edited', {
                sections: editedSections,
                config:   previewData?.config || config,
                todayStr: previewData?.todayStr,
            });
            setSuccess('✅ Report sent to Teams channel!');
        } catch (err) { setError(err.response?.data?.error || 'Failed to send report.'); }
        finally       { setSending(false); }
    };

    // ── Tab 3: Upcoming Leaves ───────────────────────────────────────────────
    const fetchUpcomingLeaves = useCallback(async (weeks = weeksAhead) => {
        setUpcomingLoading(true); setError('');
        try {
            const { data } = await api.get(`/admin/settings/teams-upcoming-leaves?weeks=${weeks}`);
            setUpcomingData(data);
            setUpcomingEmployees(data.employees.map(emp => ({
                ...emp,
                // give each leave entry a stable client-side key for removal
                leaves: emp.leaves.map((l, li) => ({ ...l, _key: `${emp.id}_${li}` })),
            })));
        } catch (err) { setError('Failed to load upcoming leaves.'); }
        finally       { setUpcomingLoading(false); }
    }, [weeksAhead]);

    useEffect(() => {
        if (tab === 3 && open && !upcomingData) fetchUpcomingLeaves(weeksAhead);
    }, [tab, open, upcomingData, fetchUpcomingLeaves, weeksAhead]);

    // Fetch full employee list for Add panel (only once per modal open)
    const fetchAllEmployees = useCallback(async () => {
        if (allEmployees.length > 0) return;
        setEmpListLoading(true);
        try {
            const { data } = await api.get('/admin/settings/teams-upcoming-leaves/employees');
            setAllEmployees(data.employees || []);
        } catch { setError('Could not load employee list.'); }
        finally  { setEmpListLoading(false); }
    }, [allEmployees.length]);

    const handleOpenAddPanel = () => {
        setShowAddPanel(true);
        fetchAllEmployees();
        // Default date range: today → today+1
        const today = new Date();
        const fmt = d => d.toISOString().split('T')[0];
        setAddDateFrom(fmt(today));
        setAddDateTo(fmt(today));
        setAddEmp(null);
        setAddLeaveType('📅 Casual Leave');
    };

    // Remove a single leave entry from an employee; remove employee row if no leaves left
    const removeLeaveEntry = (empId, leaveKey) => {
        setUpcomingEmployees(prev => {
            return prev
                .map(emp => {
                    if (emp.id !== empId) return emp;
                    return { ...emp, leaves: emp.leaves.filter(l => l._key !== leaveKey) };
                })
                .filter(emp => emp.leaves.length > 0);
        });
    };

    // Remove entire employee row
    const removeEmployee = (empId) => {
        setUpcomingEmployees(prev => prev.filter(e => e.id !== empId));
    };

    // Build a human-readable date range label from two YYYY-MM-DD strings
    const buildDateRangeLabel = (from, to) => {
        const fmt = (s) => new Date(s + 'T00:00:00+05:30').toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
        });
        return from === to ? fmt(from) : `${fmt(from)} - ${fmt(to)}`;
    };

    // Add the manually-entered employee+leave to the list
    const handleAddManual = () => {
        if (!addEmp || !addDateFrom || !addDateTo) return;
        const dateRange = buildDateRangeLabel(addDateFrom, addDateTo);
        const newLeaf = {
            leaveType: addLeaveType,
            dateRange,
            dates: [addDateFrom],
            requestType: 'Manual',
            leaveTypeRaw: addLeaveType,
            _key: `manual_${Date.now()}`,
        };

        setUpcomingEmployees(prev => {
            const existing = prev.find(e => e.id === addEmp._id);
            if (existing) {
                return prev.map(e =>
                    e.id === addEmp._id ? { ...e, leaves: [...e.leaves, newLeaf] } : e
                );
            }
            return [...prev, {
                id:          addEmp._id,
                name:        addEmp.fullName,
                designation: addEmp.designation || '—',
                leaves:      [newLeaf],
            }].sort((a, b) => a.name.localeCompare(b.name));
        });

        // Reset add panel
        setShowAddPanel(false);
        setAddEmp(null);
    };

    const handleSendUpcoming = async () => {
        setSendingUpcoming(true); clearMessages();
        try {
            await api.post('/admin/settings/teams-upcoming-leaves/send', {
                employees:  upcomingEmployees,
                weeksAhead: upcomingData?.weeksAhead || weeksAhead,
                startDate:  upcomingData?.startDate,
                endDate:    upcomingData?.endDate,
            });
            setSuccess('✅ Upcoming leaves report sent to Teams!');
        } catch (err) { setError(err.response?.data?.error || 'Failed to send.'); }
        finally       { setSendingUpcoming(false); }
    };

    const handleWeeksChange = (w) => {
        setWeeksAhead(w);
        setUpcomingData(null);
        setUpcomingEmployees([]);
        fetchUpcomingLeaves(w);
    };

    // ── Other handlers ───────────────────────────────────────────────────────
    const handleSaveWebhook = async () => {
        clearMessages();
        if (!inputUrl.startsWith('https://')) { setError('Must be a valid https:// URL.'); return; }
        setSaving(true);
        try {
            await api.post('/admin/settings/teams-webhook', { webhookUrl: inputUrl.trim() });
            setWebhookUrl(inputUrl.trim());
            setSuccess('✅ Webhook URL saved!');
        } catch (err) { setError(err.response?.data?.error || 'Failed to save.'); }
        finally       { setSaving(false); }
    };

    const handleRemoveWebhook = async () => {
        clearMessages();
        if (!window.confirm('Remove webhook? Daily notifications will stop.')) return;
        setSaving(true);
        try {
            await api.delete('/admin/settings/teams-webhook');
            setWebhookUrl(''); setInputUrl('');
            setSuccess('Webhook removed.');
        } catch (err) { setError(err.response?.data?.error || 'Failed.'); }
        finally       { setSaving(false); }
    };

    const handleSaveConfig = async () => {
        clearMessages(); setSaving(true);
        try {
            await api.post('/admin/settings/teams-report-config', { config });
            setSuccess('✅ Report settings saved!');
        } catch (err) { setError(err.response?.data?.error || 'Failed to save config.'); }
        finally       { setSaving(false); }
    };

    const handleTest = async () => {
        clearMessages(); setTesting(true);
        try {
            const { data } = await api.post('/admin/settings/teams-webhook/test');
            setSuccess(`✅ ${data.message}`);
        } catch (err) { setError(err.response?.data?.error || 'Test failed. Check server logs.'); }
        finally       { setTesting(false); }
    };

    const toggleConfig = (key) => setConfig(prev => ({ ...prev, [key]: !prev[key] }));

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: '20px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.08)',
                        overflow: 'hidden',
                        bgcolor: SOFT_WHITE,
                    },
                },
            }}
        >
            {/* ── Header ── */}
            <DialogTitle sx={{ p: 0 }}>
                <Box sx={{
                    bgcolor: SOFT_WHITE, borderTop: '4px solid', borderColor: RED,
                    px: 4, py: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Box sx={{
                            width: 48, height: 48, borderRadius: '50%', bgcolor: LIGHT_RED,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22, boxShadow: '0 2px 8px rgba(229,57,53,0.15)',
                        }}>📢</Box>
                        <Box>
                            <Typography variant="h6" fontWeight={700} sx={{ color: TEXT_PRIMARY, lineHeight: 1.3, fontSize: '1.25rem' }}>
                                Teams Notification Settings
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
                                {isConfigured ? (
                                    <Chip
                                        size="small"
                                        icon={<CheckIcon sx={{ fontSize: '14px !important', color: `${SUCCESS_GREEN} !important` }} />}
                                        label="Active"
                                        sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: SUCCESS_GREEN, height: 24, fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(16,185,129,0.2)' }}
                                    />
                                ) : (
                                    <Chip
                                        size="small"
                                        icon={<OffIcon sx={{ fontSize: '14px !important', color: `${TEXT_SECONDARY} !important` }} />}
                                        label="Not configured"
                                        sx={{ bgcolor: LIGHT_GRAY, color: TEXT_SECONDARY, height: 24, fontSize: '0.75rem', fontWeight: 600 }}
                                    />
                                )}
                                <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: '0.75rem' }}>
                                    • Daily report at {config.reportTime} IST
                                </Typography>
                            </Stack>
                        </Box>
                    </Stack>
                    <IconButton onClick={onClose} sx={{ color: TEXT_SECONDARY, '&:hover': { bgcolor: OFF_WHITE, color: TEXT_PRIMARY }, transition: 'all 0.2s ease' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Tabs */}
                <Tabs
                    value={tab}
                    onChange={(_, v) => { setTab(v); clearMessages(); setShowAddPanel(false); }}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        bgcolor: SOFT_WHITE, borderBottom: '1px solid', borderColor: BORDER_GRAY, px: 2,
                        '& .MuiTab-root': { fontWeight: 600, fontSize: '0.875rem', minHeight: 52, textTransform: 'none', color: TEXT_SECONDARY, transition: 'all 0.2s ease', '&:hover': { color: RED } },
                        '& .Mui-selected': { color: `${RED} !important`, fontWeight: 700 },
                        '& .MuiTabs-indicator': { backgroundColor: RED, height: 3, borderRadius: '3px 3px 0 0' },
                    }}
                >
                    <Tab icon={<LinkIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Webhook" />
                    <Tab icon={<TuneIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Report Content" />
                    <Tab icon={<PreviewIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Preview & Edit" />
                    <Tab icon={<CalendarIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Upcoming Leaves" />
                </Tabs>
            </DialogTitle>

            {/* ── Content ── */}
            <DialogContent sx={{ p: 0, minHeight: 420, bgcolor: OFF_WHITE }}>
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height={420}>
                        <CircularProgress sx={{ color: RED }} size={40} />
                    </Box>
                ) : (
                    <>
                        {error && (
                            <Alert severity="error" onClose={clearMessages} sx={{ mx: 4, mt: 3, borderRadius: '12px' }}>
                                {error}
                            </Alert>
                        )}
                        {success && (
                            <Alert severity="success" onClose={clearMessages} sx={{ mx: 4, mt: 3, borderRadius: '12px' }}>
                                {success}
                            </Alert>
                        )}

                        {/* ── TAB 0: Webhook ── */}
                        {tab === 0 && (
                            <Box sx={{ p: 4 }}>
                                <SectionLabel>Power Automate Webhook URL</SectionLabel>
                                <TextField
                                    fullWidth size="medium"
                                    placeholder="https://prod-xx.logic.azure.com/workflows/..."
                                    value={inputUrl}
                                    onChange={(e) => { setInputUrl(e.target.value); clearMessages(); }}
                                    disabled={saving}
                                    slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.8rem', bgcolor: SOFT_WHITE, borderRadius: '12px', '& fieldset': { borderColor: BORDER_GRAY }, '&:hover fieldset': { borderColor: RED }, '&.Mui-focused fieldset': { borderColor: RED, borderWidth: '2px', boxShadow: `0 0 0 3px ${LIGHT_RED}` } } } }}
                                    sx={{ mb: 2 }}
                                />
                                <Stack direction="row" spacing={1.5} mb={4}>
                                    <Button
                                        variant="contained"
                                        onClick={handleSaveWebhook}
                                        disabled={saving || !inputUrl || inputUrl === webhookUrl}
                                        sx={{ bgcolor: RED, color: 'white', textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 3, py: 1, borderRadius: '12px', boxShadow: '0 4px 12px rgba(229,57,53,0.25)', '&:hover': { bgcolor: '#c62828', transform: 'translateY(-1px)' }, transition: 'all 0.2s ease' }}
                                    >
                                        {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save URL'}
                                    </Button>
                                    {isConfigured && (
                                        <Button
                                            variant="outlined" color="error"
                                            onClick={handleRemoveWebhook} disabled={saving} startIcon={<DeleteIcon />}
                                            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 3, py: 1, borderRadius: '12px', borderColor: RED, color: RED, '&:hover': { borderColor: '#c62828', bgcolor: LIGHT_RED }, transition: 'all 0.2s ease' }}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </Stack>

                                <Divider sx={{ mb: 3, borderColor: BORDER_GRAY }} />

                                <Box
                                    onClick={() => setShowGuide(p => !p)}
                                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', p: 2, borderRadius: '12px', bgcolor: SOFT_WHITE, border: '1px solid', borderColor: BORDER_GRAY, mb: showGuide ? 2 : 0, transition: 'all 0.2s ease', '&:hover': { borderColor: RED, boxShadow: '0 2px 8px rgba(229,57,53,0.1)' } }}
                                >
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: LIGHT_RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <HelpIcon sx={{ fontSize: 18, color: RED }} />
                                        </Box>
                                        <Typography variant="body2" fontWeight={600} sx={{ color: TEXT_PRIMARY, fontSize: '0.875rem' }}>
                                            How to get your webhook URL (5 min setup)
                                        </Typography>
                                    </Stack>
                                    {showGuide ? <CollapseIcon sx={{ fontSize: 20, color: RED }} /> : <ExpandIcon sx={{ fontSize: 20, color: RED }} />}
                                </Box>

                                <Collapse in={showGuide}>
                                    <Box sx={{ bgcolor: SOFT_WHITE, borderRadius: '12px', border: '1px solid', borderColor: BORDER_GRAY, p: 3 }}>
                                        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2.2, fontSize: 14, color: TEXT_PRIMARY }}>
                                            {[
                                                'Open Teams → go to the channel → click + (Add a tab) → open Workflows',
                                                'Search "Post to a channel when a webhook request is received" → select it',
                                                'Name it (e.g. AMS Attendance Report) → choose Team & Channel',
                                                'Click Add workflow → Copy the generated URL',
                                                'Paste it above and click Save URL',
                                            ].map((step, idx) => (
                                                <li key={idx} style={{ marginBottom: 12 }}>
                                                    <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                                                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: LIGHT_RED, color: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, mt: 0.2 }}>{idx + 1}</Box>
                                                        <Typography variant="body2" sx={{ color: TEXT_PRIMARY, fontSize: '0.875rem', lineHeight: 1.6 }}
                                                            dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                                                        />
                                                    </Stack>
                                                </li>
                                            ))}
                                        </ol>
                                        <Alert severity="warning" sx={{ mt: 2, py: 1.5, fontSize: '0.8rem', borderRadius: '10px', bgcolor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', '& .MuiAlert-icon': { color: '#F59E0B' } }}>
                                            Do <strong>not</strong> use the old Connectors — Microsoft retired them in 2024. Use <strong>Workflows</strong> only.
                                        </Alert>
                                    </Box>
                                </Collapse>
                            </Box>
                        )}

                        {/* ── TAB 1: Report Content ── */}
                        {tab === 1 && (
                            <Box sx={{ p: 4 }}>
                                <SectionLabel>Report Time</SectionLabel>
                                <Paper elevation={0} sx={{ bgcolor: SOFT_WHITE, border: '1px solid', borderColor: BORDER_GRAY, borderRadius: '14px', p: 3, mb: 4 }}>
                                    <Stack direction="row" alignItems="center" spacing={2}>
                                        <TextField
                                            type="time"
                                            value={config.reportTime}
                                            onChange={(e) => setConfig(prev => ({ ...prev, reportTime: e.target.value }))}
                                            slotProps={{ input: { step: 300, sx: { borderRadius: '10px', bgcolor: OFF_WHITE, '& fieldset': { borderColor: BORDER_GRAY }, '&:hover fieldset': { borderColor: RED }, '&.Mui-focused fieldset': { borderColor: RED, borderWidth: '2px' } } } }}
                                            sx={{ width: 160 }}
                                        />
                                        <Typography variant="body2" sx={{ color: TEXT_SECONDARY, fontSize: '0.875rem', lineHeight: 1.5 }}>
                                            IST — report and preview notification fire at this time daily. Changes take effect on the next poll cycle (within 60 seconds) — no restart needed.
                                        </Typography>
                                    </Stack>
                                </Paper>

                                <SectionLabel>Who to Include</SectionLabel>
                                <Paper elevation={0} sx={{ bgcolor: SOFT_WHITE, border: '1px solid', borderColor: BORDER_GRAY, borderRadius: '14px', px: 3, py: 1, mb: 4 }}>
                                    <ToggleRow label="Absent Employees" sublabel="Did not clock in and no approved leave" checked={config.showAbsent} onChange={() => toggleConfig('showAbsent')} />
                                    <ToggleRow label="Employees On Leave" sublabel="Have an approved leave request for today" checked={config.showOnLeave} onChange={() => toggleConfig('showOnLeave')} />
                                    <ToggleRow label="Late Employees" sublabel="Clocked in after the grace period" checked={config.showLateEmployees} onChange={() => toggleConfig('showLateEmployees')} />
                                    <ToggleRow label="Present Employees" sublabel="All employees who clocked in on time" checked={config.showPresent} onChange={() => toggleConfig('showPresent')} />
                                </Paper>

                                <SectionLabel>Extra Columns in the Table</SectionLabel>
                                <Paper elevation={0} sx={{ bgcolor: SOFT_WHITE, border: '1px solid', borderColor: BORDER_GRAY, borderRadius: '14px', px: 3, py: 1, mb: 2 }}>
                                    <ToggleRow label="Clock-In Time" sublabel="Shows exact time employee clocked in" checked={config.showClockInTime} onChange={() => toggleConfig('showClockInTime')} disabled={!config.showPresent && !config.showLateEmployees} />
                                    <ToggleRow label="Late By (minutes)" sublabel="How many minutes late they arrived" checked={config.showLateMinutes} onChange={() => toggleConfig('showLateMinutes')} disabled={!config.showLateEmployees} />
                                    <ToggleRow label="Working Hours" sublabel="Total hours logged (useful later in the day)" checked={config.showWorkingHours} onChange={() => toggleConfig('showWorkingHours')} disabled={!config.showPresent && !config.showLateEmployees} />
                                </Paper>
                            </Box>
                        )}

                        {/* ── TAB 2: Today's Preview & Edit ── */}
                        {tab === 2 && (
                            <Box sx={{ p: 4 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                                    <Typography variant="overline" sx={{ color: RED, fontWeight: 600, fontSize: '0.75rem', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                                        Today's Report Preview
                                    </Typography>
                                    <Button
                                        size="small" startIcon={<RefreshIcon />}
                                        onClick={() => { setPreviewData(null); setEditedSections(null); fetchPreviewData(); }}
                                        sx={{ textTransform: 'none', color: RED, fontWeight: 600, fontSize: '0.875rem', px: 2, py: 0.75, borderRadius: '20px', '&:hover': { bgcolor: LIGHT_RED }, transition: 'all 0.2s ease' }}
                                    >
                                        Refresh
                                    </Button>
                                </Stack>

                                {previewLoading ? (
                                    <Box display="flex" justifyContent="center" alignItems="center" height={280}>
                                        <CircularProgress sx={{ color: RED }} size={40} />
                                    </Box>
                                ) : !previewData ? (
                                    <Alert severity="info" sx={{ borderRadius: '14px', bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', '& .MuiAlert-icon': { color: '#3B82F6' } }}>
                                        Click Refresh to load today's attendance data.
                                    </Alert>
                                ) : (
                                    <>
                                        {/* Summary chips */}
                                        <Stack direction="row" spacing={1.5} flexWrap="wrap" mb={3}>
                                            {(['absent', 'onLeave', 'late', 'present']).map(section => {
                                                const count    = editedSections?.[section]?.length ?? 0;
                                                const original = previewData.sections?.[section]?.length ?? 0;
                                                const labelMap = { absent: 'Absent', onLeave: 'On Leave', late: 'Late', present: 'Present' };
                                                const colorMap = {
                                                    absent:  { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#ef4444' },
                                                    onLeave: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
                                                    late:    { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#f97316' },
                                                    present: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#10b981' },
                                                };
                                                const c = colorMap[section];
                                                return (
                                                    <Chip key={section}
                                                        label={`${labelMap[section]}: ${count}${count !== original ? ` (was ${original})` : ''}`}
                                                        sx={{ fontWeight: 600, fontSize: '0.8125rem', height: 32, bgcolor: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '20px', px: 1 }}
                                                    />
                                                );
                                            })}
                                        </Stack>

                                        <Alert severity="info" icon={<EditIcon />} sx={{ mb: 3.5, borderRadius: '14px', fontSize: '0.875rem', bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', '& .MuiAlert-icon': { color: '#3B82F6' }, '& .MuiAlert-message': { color: TEXT_PRIMARY } }}>
                                            Remove employees from the report before sending. Changes only affect <strong>this send</strong> — no settings are modified.
                                        </Alert>

                                        {[
                                            { key: 'absent',  label: 'ABSENT',   emoji: '🔴', color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)' },
                                            { key: 'onLeave', label: 'ON LEAVE', emoji: '🟡', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)' },
                                            { key: 'late',    label: 'LATE',     emoji: '🕐', color: '#f97316', bgColor: 'rgba(249,115,22,0.08)' },
                                            { key: 'present', label: 'PRESENT',  emoji: '✅', color: '#10b981', bgColor: 'rgba(16,185,129,0.08)' },
                                        ].filter(s => (editedSections?.[s.key]?.length ?? 0) > 0).map(({ key, label, emoji, color, bgColor }) => (
                                            <Box key={key} mb={3.5}>
                                                <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                                                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{emoji}</Box>
                                                    <Typography variant="caption" sx={{ color, fontWeight: 700, fontSize: '0.75rem', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                                                        {label} ({editedSections[key].length})
                                                    </Typography>
                                                </Stack>
                                                <Paper elevation={0} sx={{ border: '1px solid', borderColor: BORDER_GRAY, borderRadius: '14px', overflow: 'hidden', bgcolor: SOFT_WHITE }}>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow sx={{ bgcolor: OFF_WHITE }}>
                                                                <TableCell sx={{ fontWeight: 700, color: TEXT_PRIMARY, fontSize: '0.8125rem', py: 1.5 }}>Employee</TableCell>
                                                                <TableCell sx={{ fontWeight: 700, color: TEXT_PRIMARY, fontSize: '0.8125rem', py: 1.5 }}>Designation</TableCell>
                                                                {key === 'onLeave' && <TableCell sx={{ fontWeight: 700, color: TEXT_PRIMARY, fontSize: '0.8125rem', py: 1.5 }}>Leave Type</TableCell>}
                                                                {(key === 'present' || key === 'late') && <TableCell sx={{ fontWeight: 700, color: TEXT_PRIMARY, fontSize: '0.8125rem', py: 1.5 }}>Clock In</TableCell>}
                                                                {key === 'late' && <TableCell sx={{ fontWeight: 700, color: TEXT_PRIMARY, fontSize: '0.8125rem', py: 1.5 }}>Late By</TableCell>}
                                                                <TableCell sx={{ width: 56 }} />
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {editedSections[key].map((emp, idx) => (
                                                                <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 }, '&:hover': { bgcolor: OFF_WHITE }, transition: 'background-color 0.2s ease' }}>
                                                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem', color: TEXT_PRIMARY, py: 2 }}>{emp.name}</TableCell>
                                                                    <TableCell sx={{ color: TEXT_SECONDARY, fontSize: '0.8125rem', py: 2 }}>{emp.designation || '—'}</TableCell>
                                                                    {key === 'onLeave' && <TableCell sx={{ color: TEXT_SECONDARY, fontSize: '0.8125rem', py: 2 }}>{emp.leaveType}</TableCell>}
                                                                    {(key === 'present' || key === 'late') && (
                                                                        <TableCell sx={{ color: TEXT_SECONDARY, fontSize: '0.8125rem', py: 2 }}>
                                                                            {emp.clockInTime ? new Date(emp.clockInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—'}
                                                                        </TableCell>
                                                                    )}
                                                                    {key === 'late' && <TableCell sx={{ color: '#f97316', fontSize: '0.8125rem', fontWeight: 600, py: 2 }}>{emp.lateMinutes ? `${emp.lateMinutes} min` : '—'}</TableCell>}
                                                                    <TableCell align="right" sx={{ py: 2 }}>
                                                                        <Tooltip title="Remove from report">
                                                                            <IconButton size="small" onClick={() => removeFromPreview(key, idx)} sx={{ color: '#ef4444', width: 32, height: 32, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' }, transition: 'all 0.2s ease' }}>
                                                                                <PersonRemoveIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </Paper>
                                            </Box>
                                        ))}

                                        {Object.values(editedSections || {}).every(arr => arr.length === 0) && (
                                            <Alert severity="success" sx={{ borderRadius: '14px', bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', '& .MuiAlert-icon': { color: SUCCESS_GREEN } }}>
                                                All employees removed — nothing will be sent to Teams.
                                            </Alert>
                                        )}
                                    </>
                                )}
                            </Box>
                        )}

                        {/* ── TAB 3: Upcoming Leaves ── */}
                        {tab === 3 && (
                            <Box sx={{ p: 4 }}>

                                {/* ── Header row: title + week selector + refresh + add ── */}
                                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={1.5}>
                                    <Box>
                                        <Typography variant="overline" sx={{ color: RED, fontWeight: 600, fontSize: '0.75rem', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block' }}>
                                            Upcoming Leaves
                                        </Typography>
                                        {upcomingData && (
                                            <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: '0.75rem' }}>
                                                {new Date(upcomingData.startDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                                                {' '}–{' '}
                                                {new Date(upcomingData.endDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                            </Typography>
                                        )}
                                    </Box>

                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {/* Week selector */}
                                        <Select
                                            size="small"
                                            value={weeksAhead}
                                            onChange={(e) => handleWeeksChange(e.target.value)}
                                            sx={{ borderRadius: '10px', fontSize: '0.875rem', bgcolor: SOFT_WHITE, minWidth: 130, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER_GRAY }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: RED }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: RED } }}
                                        >
                                            {[1, 2, 3, 4, 6, 8].map(w => (
                                                <MenuItem key={w} value={w} sx={{ fontSize: '0.875rem' }}>
                                                    Next {w} week{w > 1 ? 's' : ''}
                                                </MenuItem>
                                            ))}
                                        </Select>

                                        {/* Refresh */}
                                        <Tooltip title="Refresh from system">
                                            <IconButton
                                                size="small"
                                                onClick={() => { setUpcomingData(null); setUpcomingEmployees([]); setShowAddPanel(false); fetchUpcomingLeaves(weeksAhead); }}
                                                sx={{ color: RED, bgcolor: LIGHT_RED, borderRadius: '10px', width: 36, height: 36, '&:hover': { bgcolor: 'rgba(229,57,53,0.15)' }, transition: 'all 0.2s ease' }}
                                            >
                                                <RefreshIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                        {/* Add manual entry */}
                                        <Button
                                            size="small"
                                            startIcon={<PersonAddIcon />}
                                            onClick={handleOpenAddPanel}
                                            disabled={upcomingLoading}
                                            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 2, py: 0.75, borderRadius: '10px', bgcolor: RED, color: 'white', boxShadow: '0 2px 8px rgba(229,57,53,0.25)', '&:hover': { bgcolor: '#c62828', transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(229,57,53,0.35)' }, transition: 'all 0.2s ease' }}
                                        >
                                            Add Employee
                                        </Button>
                                    </Stack>
                                </Stack>

                                {/* ── Add Manual Entry Panel ── */}
                                <Collapse in={showAddPanel}>
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            border: '1.5px dashed', borderColor: RED, borderRadius: '16px',
                                            p: 3, mb: 3, bgcolor: 'rgba(229,57,53,0.03)',
                                        }}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
                                            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: LIGHT_RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <EventNoteIcon sx={{ fontSize: 18, color: RED }} />
                                            </Box>
                                            <Typography fontWeight={700} sx={{ color: TEXT_PRIMARY, fontSize: '0.9rem' }}>
                                                Add a manual leave entry
                                            </Typography>
                                            <Box sx={{ flex: 1 }} />
                                            <IconButton size="small" onClick={() => setShowAddPanel(false)} sx={{ color: TEXT_SECONDARY }}>
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>

                                        <Alert severity="info" sx={{ mb: 2.5, borderRadius: '10px', fontSize: '0.8125rem', bgcolor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', '& .MuiAlert-icon': { color: '#3B82F6' } }}>
                                            Use this for employees who informed leave <strong>verbally</strong> but haven't submitted in the system. This entry appears <strong>only in this Teams message</strong> and doesn't create a leave record.
                                        </Alert>

                                        <Stack spacing={2}>
                                            {/* Employee search */}
                                            <Autocomplete
                                                options={allEmployees}
                                                getOptionLabel={(opt) => `${opt.fullName}${opt.designation ? ` — ${opt.designation}` : ''}`}
                                                value={addEmp}
                                                onChange={(_, val) => setAddEmp(val)}
                                                loading={empListLoading}
                                                isOptionEqualToValue={(opt, val) => opt._id === val._id}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Employee"
                                                        size="small"
                                                        sx={{ bgcolor: SOFT_WHITE, borderRadius: '10px', '& .MuiOutlinedInput-root': { borderRadius: '10px', '& fieldset': { borderColor: BORDER_GRAY }, '&:hover fieldset': { borderColor: RED }, '&.Mui-focused fieldset': { borderColor: RED } } }}
                                                        slotProps={{ input: { ...params.InputProps, endAdornment: (<>{empListLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) } }}
                                                    />
                                                )}
                                            />

                                            {/* Leave type */}
                                            <FormControl size="small">
                                                <InputLabel sx={{ '&.Mui-focused': { color: RED } }}>Leave Type</InputLabel>
                                                <Select
                                                    value={addLeaveType}
                                                    label="Leave Type"
                                                    onChange={(e) => setAddLeaveType(e.target.value)}
                                                    sx={{ borderRadius: '10px', bgcolor: SOFT_WHITE, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER_GRAY }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: RED }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: RED } }}
                                                >
                                                    {LEAVE_TYPES.map(lt => (
                                                        <MenuItem key={lt.value} value={lt.value} sx={{ fontSize: '0.875rem' }}>{lt.label}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>

                                            {/* Date range */}
                                            <Stack direction="row" spacing={2}>
                                                <TextField
                                                    label="From date"
                                                    type="date"
                                                    size="small"
                                                    value={addDateFrom}
                                                    onChange={(e) => {
                                                        setAddDateFrom(e.target.value);
                                                        if (e.target.value > addDateTo) setAddDateTo(e.target.value);
                                                    }}
                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                    sx={{ flex: 1, bgcolor: SOFT_WHITE, borderRadius: '10px', '& .MuiOutlinedInput-root': { borderRadius: '10px', '& fieldset': { borderColor: BORDER_GRAY }, '&:hover fieldset': { borderColor: RED }, '&.Mui-focused fieldset': { borderColor: RED } } }}
                                                />
                                                <TextField
                                                    label="To date"
                                                    type="date"
                                                    size="small"
                                                    value={addDateTo}
                                                    onChange={(e) => setAddDateTo(e.target.value)}
                                                    slotProps={{ inputLabel: { shrink: true }, input: { inputProps: { min: addDateFrom } } }}
                                                    sx={{ flex: 1, bgcolor: SOFT_WHITE, borderRadius: '10px', '& .MuiOutlinedInput-root': { borderRadius: '10px', '& fieldset': { borderColor: BORDER_GRAY }, '&:hover fieldset': { borderColor: RED }, '&.Mui-focused fieldset': { borderColor: RED } } }}
                                                />
                                            </Stack>

                                            {/* Action buttons */}
                                            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                                                <Button
                                                    variant="text"
                                                    onClick={() => setShowAddPanel(false)}
                                                    sx={{ textTransform: 'none', fontWeight: 600, color: TEXT_SECONDARY, borderRadius: '10px', px: 2 }}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    variant="contained"
                                                    onClick={handleAddManual}
                                                    disabled={!addEmp || !addDateFrom || !addDateTo}
                                                    startIcon={<PersonAddIcon />}
                                                    sx={{ textTransform: 'none', fontWeight: 600, bgcolor: RED, color: 'white', borderRadius: '10px', px: 3, boxShadow: '0 2px 8px rgba(229,57,53,0.25)', '&:hover': { bgcolor: '#c62828' }, '&:disabled': { bgcolor: LIGHT_GRAY, color: TEXT_SECONDARY }, transition: 'all 0.2s ease' }}
                                                >
                                                    Add to Report
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                </Collapse>

                                {/* ── Loading / empty / list ── */}
                                {upcomingLoading ? (
                                    <Box display="flex" justifyContent="center" alignItems="center" height={260}>
                                        <CircularProgress sx={{ color: RED }} size={40} />
                                    </Box>
                                ) : !upcomingData ? (
                                    <Alert severity="info" sx={{ borderRadius: '14px', bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', '& .MuiAlert-icon': { color: '#3B82F6' } }}>
                                        Loading upcoming leaves…
                                    </Alert>
                                ) : upcomingEmployees.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 6 }}>
                                        <Typography sx={{ fontSize: '2.5rem', mb: 1.5 }}>🎉</Typography>
                                        <Typography fontWeight={700} sx={{ color: TEXT_PRIMARY, fontSize: '1rem', mb: 0.5 }}>
                                            No leaves in this period
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>
                                            No approved leaves found for the next {weeksAhead} week{weeksAhead > 1 ? 's' : ''}. You can still add manual entries above.
                                        </Typography>
                                    </Box>
                                ) : (
                                    <>
                                        {/* Summary strip */}
                                        <Stack direction="row" spacing={1.5} flexWrap="wrap" mb={3}>
                                            <Chip
                                                icon={<CalendarIcon sx={{ fontSize: '15px !important', color: '#6366f1 !important' }} />}
                                                label={`${upcomingEmployees.length} employee${upcomingEmployees.length > 1 ? 's' : ''} on leave`}
                                                sx={{ fontWeight: 600, fontSize: '0.8125rem', height: 32, bgcolor: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '20px', px: 1 }}
                                            />
                                            <Chip
                                                label={`${upcomingEmployees.reduce((s, e) => s + e.leaves.length, 0)} total entries`}
                                                sx={{ fontWeight: 600, fontSize: '0.8125rem', height: 32, bgcolor: OFF_WHITE, color: TEXT_SECONDARY, border: `1px solid ${BORDER_GRAY}`, borderRadius: '20px', px: 1 }}
                                            />
                                        </Stack>

                                        <Alert severity="info" icon={<EditIcon />} sx={{ mb: 3, borderRadius: '14px', fontSize: '0.875rem', bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', '& .MuiAlert-icon': { color: '#3B82F6' }, '& .MuiAlert-message': { color: TEXT_PRIMARY } }}>
                                            Review and edit the list before sending. You can remove employees or individual leave entries, or add missing ones above.
                                        </Alert>

                                        {/* Employee cards */}
                                        <Stack spacing={2}>
                                            {upcomingEmployees.map((emp) => (
                                                <Paper
                                                    key={emp.id}
                                                    elevation={0}
                                                    sx={{
                                                        border: '1px solid', borderColor: BORDER_GRAY,
                                                        borderRadius: '16px', overflow: 'hidden', bgcolor: SOFT_WHITE,
                                                        transition: 'box-shadow 0.2s ease',
                                                        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.07)' },
                                                    }}
                                                >
                                                    {/* Employee header */}
                                                    <Box sx={{
                                                        px: 3, py: 1.75,
                                                        bgcolor: OFF_WHITE,
                                                        borderBottom: '1px solid', borderColor: BORDER_GRAY,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    }}>
                                                        <Stack direction="row" alignItems="center" spacing={1.5}>
                                                            <Box sx={{
                                                                width: 36, height: 36, borderRadius: '50%',
                                                                bgcolor: LIGHT_RED,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontWeight: 700, fontSize: '0.875rem', color: RED,
                                                                flexShrink: 0,
                                                            }}>
                                                                {emp.name.charAt(0).toUpperCase()}
                                                            </Box>
                                                            <Box>
                                                                <Typography fontWeight={700} sx={{ fontSize: '0.9rem', color: TEXT_PRIMARY, lineHeight: 1.3 }}>
                                                                    {emp.name}
                                                                </Typography>
                                                                {emp.designation && emp.designation !== '—' && (
                                                                    <Typography variant="caption" sx={{ color: TEXT_SECONDARY, fontSize: '0.75rem' }}>
                                                                        {emp.designation}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Stack>

                                                        <Tooltip title="Remove employee entirely">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => removeEmployee(emp.id)}
                                                                sx={{ color: '#ef4444', width: 32, height: 32, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' }, transition: 'all 0.2s ease' }}
                                                            >
                                                                <PersonRemoveIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>

                                                    {/* Leave entries table */}
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow sx={{ bgcolor: '#fafafa' }}>
                                                                <TableCell sx={{ fontWeight: 700, color: TEXT_SECONDARY, fontSize: '0.75rem', py: 1.25, letterSpacing: 0.5, textTransform: 'uppercase' }}>Leave Type</TableCell>
                                                                <TableCell sx={{ fontWeight: 700, color: TEXT_SECONDARY, fontSize: '0.75rem', py: 1.25, letterSpacing: 0.5, textTransform: 'uppercase' }}>Dates</TableCell>
                                                                <TableCell sx={{ width: 52 }} />
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {emp.leaves.map((leave) => (
                                                                <TableRow
                                                                    key={leave._key}
                                                                    sx={{ '&:last-child td': { borderBottom: 0 }, '&:hover': { bgcolor: OFF_WHITE }, transition: 'background-color 0.15s ease' }}
                                                                >
                                                                    <TableCell sx={{ py: 1.5 }}>
                                                                        <Chip
                                                                            label={leave.leaveType}
                                                                            size="small"
                                                                            sx={{
                                                                                fontSize: '0.8rem', fontWeight: 600, height: 26,
                                                                                bgcolor: 'rgba(245,158,11,0.1)', color: '#b45309',
                                                                                border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px',
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell sx={{ color: TEXT_SECONDARY, fontSize: '0.8125rem', py: 1.5 }}>
                                                                        {leave.dateRange}
                                                                    </TableCell>
                                                                    <TableCell align="right" sx={{ py: 1.5, pr: 2 }}>
                                                                        <Tooltip title="Remove this leave entry">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => removeLeaveEntry(emp.id, leave._key)}
                                                                                sx={{ color: '#ef4444', width: 28, height: 28, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' }, transition: 'all 0.2s ease' }}
                                                                            >
                                                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </Paper>
                                            ))}
                                        </Stack>
                                    </>
                                )}
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>

            {/* ── Footer Actions ── */}
            <DialogActions sx={{ px: 4, py: 3, bgcolor: SOFT_WHITE, borderTop: '1px solid', borderColor: BORDER_GRAY, gap: 1.5 }}>

                {tab === 1 && (
                    <Button
                        variant="contained" onClick={handleSaveConfig} disabled={saving}
                        sx={{ bgcolor: RED, color: 'white', textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 4, py: 1.25, borderRadius: '12px', boxShadow: '0 4px 12px rgba(229,57,53,0.25)', mr: 'auto', '&:hover': { bgcolor: '#c62828', transform: 'translateY(-1px)' }, '&:disabled': { bgcolor: LIGHT_GRAY, color: TEXT_SECONDARY }, transition: 'all 0.2s ease' }}
                    >
                        {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Settings'}
                    </Button>
                )}

                {tab === 2 && editedSections && isConfigured && (
                    <Button
                        variant="contained"
                        startIcon={sending ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SendIcon />}
                        onClick={handleSendEdited}
                        disabled={sending || Object.values(editedSections).every(arr => arr.length === 0)}
                        sx={{ bgcolor: RED, color: 'white', textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 4, py: 1.25, borderRadius: '12px', boxShadow: '0 4px 12px rgba(229,57,53,0.25)', mr: 'auto', '&:hover': { bgcolor: '#c62828', transform: 'translateY(-1px)' }, '&:disabled': { bgcolor: LIGHT_GRAY, color: TEXT_SECONDARY }, transition: 'all 0.2s ease' }}
                    >
                        {sending ? 'Sending...' : 'Send to Teams'}
                    </Button>
                )}

                {/* ── Tab 3: Upcoming Leaves send button ── */}
                {tab === 3 && upcomingData && isConfigured && (
                    <Button
                        variant="contained"
                        startIcon={sendingUpcoming ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SendIcon />}
                        onClick={handleSendUpcoming}
                        disabled={sendingUpcoming || upcomingEmployees.length === 0}
                        sx={{ bgcolor: RED, color: 'white', textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 4, py: 1.25, borderRadius: '12px', boxShadow: '0 4px 12px rgba(229,57,53,0.25)', mr: 'auto', '&:hover': { bgcolor: '#c62828', transform: 'translateY(-1px)' }, '&:disabled': { bgcolor: LIGHT_GRAY, color: TEXT_SECONDARY }, transition: 'all 0.2s ease' }}
                    >
                        {sendingUpcoming ? 'Sending...' : `Send Upcoming Leaves to Teams`}
                    </Button>
                )}

                {isConfigured && (
                    <Button
                        variant="outlined"
                        startIcon={testing ? <CircularProgress size={16} /> : <SendIcon />}
                        onClick={handleTest} disabled={testing || saving}
                        sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 3, py: 1.25, borderRadius: '12px', borderColor: RED, color: RED, bgcolor: SOFT_WHITE, '&:hover': { borderColor: '#c62828', bgcolor: LIGHT_RED }, transition: 'all 0.2s ease' }}
                    >
                        Send Test Now
                    </Button>
                )}

                <Button
                    onClick={onClose}
                    sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 3, py: 1.25, color: TEXT_SECONDARY, '&:hover': { bgcolor: OFF_WHITE, color: TEXT_PRIMARY }, transition: 'all 0.2s ease' }}
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default TeamsNotificationModal;
