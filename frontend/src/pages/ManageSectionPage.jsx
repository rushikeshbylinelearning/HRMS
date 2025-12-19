// frontend/src/pages/ManageSectionPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Chip,
  Grid,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Avatar,
  Stack,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  Menu
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  Search as SearchIcon,
  RestartAlt as RestartAltIcon,
  PeopleAlt as PeopleAltIcon,
  Insights as InsightsIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import api from '../api/axios';
import '../styles/ManageSectionPage.css';
import PageHeroHeader from '../components/PageHeroHeader';

const SECTION_CARD_BASE = {
  p: 3,
  borderRadius: '18px',
  border: '1px solid #e5e9f2',
  background: 'linear-gradient(145deg, #ffffff 0%, #f7f9fc 100%)',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08)',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '100%',
};

const createCardStyles = (accent = 'rgba(229, 57, 53, 0.12)') => ({
  ...SECTION_CARD_BASE,
  '&:before': {
    content: '""',
    position: 'absolute',
    left: -60,
    top: -60,
    width: 160,
    height: 160,
    borderRadius: '50%',
    background: accent,
    filter: 'blur(60px)',
    opacity: 0.9,
  },
  '&:after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: '18px',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    pointerEvents: 'none',
  },
});

const normalizeRole = (role) => (role && role.trim()) || 'Employee';
const getPrivilegeLevel = (user) => user?.featurePermissions?.privilegeLevel || 'normal';

const ManageSectionPage = () => {
  const [users, setUsers] = useState([]);
  const [originalUsers, setOriginalUsers] = useState([]); // Store original data for comparison
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userModal, setUserModal] = useState({ open: false, user: null });
  const [resetDialog, setResetDialog] = useState({ open: false, userId: null, userName: '' });
  const [unsavedChanges, setUnsavedChanges] = useState({}); // Track unsaved changes per user
  const [bulkDialog, setBulkDialog] = useState({ open: false, selectedUsers: [], applyToAll: false });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedPrivilege, setSelectedPrivilege] = useState('all');
  const [showUnsavedOnly, setShowUnsavedOnly] = useState(false);
  const [bulkSettings, setBulkSettings] = useState({
    featurePermissions: {
      leaves: true,
      breaks: true,
      extraFeatures: false,
      maxBreaks: 999,
      breakAfterHours: 0,
      breakWindows: [],
      canCheckIn: true,
      canCheckOut: true,
      canTakeBreak: true,
      canViewAnalytics: false, // New field for analytics access
      privilegeLevel: 'normal',
      restrictedFeatures: {
        canViewReports: false,
        canViewOtherLogs: false,
        canEditProfile: true,
        canRequestExtraBreak: true
      },
      advancedFeatures: {
        canBulkActions: false,
        canExportData: false
      },
      autoBreakOnInactivity: false,
      inactivityThresholdMinutes: 5
    }
  });
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(30);
  const [graceDialog, setGraceDialog] = useState({ open: false, value: 30 });
  const [updatingGrace, setUpdatingGrace] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Fetch all users with their permissions
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/manage');
      setUsers(response.data);
      setOriginalUsers(JSON.parse(JSON.stringify(response.data))); // Deep copy for comparison
      setUnsavedChanges({}); // Clear unsaved changes when fetching fresh data
    } catch (err) {
      setError('Failed to fetch users and permissions');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchGracePeriod = useCallback(async () => {
    try {
      const response = await api.get('/analytics/late-grace-settings');
      const minutes = Number(response.data?.minutes ?? 30);
      setGracePeriodMinutes(minutes);
      setGraceDialog(prev => ({ ...prev, value: minutes }));
    } catch (err) {
      console.error('Failed to fetch grace period:', err);
    }
  }, []);

  useEffect(() => {
    fetchGracePeriod();
  }, [fetchGracePeriod]);

  // Check if user has unsaved changes
  const hasUnsavedChanges = useCallback((userId) => {
    const currentUser = users.find(u => u._id === userId);
    const originalUser = originalUsers.find(u => u._id === userId);
    
    if (!currentUser || !originalUser) return false;
    
    return JSON.stringify(currentUser.featurePermissions) !== JSON.stringify(originalUser.featurePermissions);
  }, [users, originalUsers]);

  const unsavedCount = useMemo(() => (
    users.reduce((count, user) => count + (hasUnsavedChanges(user._id) ? 1 : 0), 0)
  ), [users, hasUnsavedChanges]);

  const roleOptions = useMemo(() => {
    const uniqueRoles = new Set();
    users.forEach(user => uniqueRoles.add(normalizeRole(user.role)));
    return Array.from(uniqueRoles).sort();
  }, [users]);

const privilegeOptions = useMemo(() => {
    const uniquePrivileges = new Set();
    users.forEach(user => uniquePrivileges.add(getPrivilegeLevel(user)));
    return Array.from(uniquePrivileges);
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const roleMatches = selectedRole === 'all' || normalizeRole(user.role) === selectedRole;
      const privilegeMatches = selectedPrivilege === 'all' || getPrivilegeLevel(user) === selectedPrivilege;
      const searchMatches =
        term.length === 0 ||
        user.fullName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.employeeCode?.toLowerCase().includes(term);
      const unsavedMatches = !showUnsavedOnly || hasUnsavedChanges(user._id);
      return roleMatches && privilegeMatches && searchMatches && unsavedMatches;
    });
  }, [users, selectedRole, selectedPrivilege, searchTerm, showUnsavedOnly, hasUnsavedChanges]);

  const analyticsEnabledCount = useMemo(
    () => users.filter((user) => user.featurePermissions?.canViewAnalytics).length,
    [users]
  );

  const advancedPrivilegeCount = useMemo(
    () => users.filter((user) => getPrivilegeLevel(user) === 'advanced').length,
    [users]
  );

  const adminRoleCount = useMemo(
    () =>
      users.filter((user) => normalizeRole(user.role).toLowerCase().includes('admin')).length,
    [users]
  );

  // Save user permissions
  const saveUserPermissions = useCallback(async (userId) => {
    const user = users.find(u => u._id === userId);
    if (!user) return;

    try {
      setSaving(prev => ({ ...prev, [userId]: true }));
      setError(null);

      const response = await api.put(`/admin/manage/${userId}`, {
        featurePermissions: user.featurePermissions
      });

      // Update local state with saved data
      const updatedUser = response.data.user;
      setUsers(prev => prev.map(u => 
        u._id === userId ? { ...u, featurePermissions: updatedUser.featurePermissions } : u
      ));
      setOriginalUsers(prev => prev.map(u => 
        u._id === userId ? { ...u, featurePermissions: updatedUser.featurePermissions } : u
      ));

      // Clear unsaved changes for this user
      setUnsavedChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[userId];
        return newChanges;
      });

      setSuccess(`Permissions saved for ${updatedUser.fullName}. The user will see changes on their next page refresh.`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Failed to save user permissions');
      console.error('Error saving permissions:', err);
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }));
    }
  }, [users]);

  // Reset user permissions to defaults
  const resetUserPermissions = useCallback(async (userId) => {
    try {
      setSaving(prev => ({ ...prev, [userId]: true }));
      setError(null);

      await api.post(`/admin/manage/${userId}/reset`);
      
      // Refresh the user data
      await fetchUsers();
      
      setSuccess('User permissions reset to defaults. The user will see changes on their next page refresh.');
      setTimeout(() => setSuccess(null), 5000);
      setResetDialog({ open: false, userId: null, userName: '' });
    } catch (err) {
      setError('Failed to reset user permissions');
      console.error('Error resetting permissions:', err);
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }));
    }
  }, [fetchUsers]);

  // Bulk apply settings to selected users
  const applyBulkSettings = useCallback(async () => {
    try {
      setSaving(prev => ({ ...prev, bulk: true }));
      setError(null);

      // Validate that users are selected
      if (!bulkDialog.applyToAll && bulkDialog.selectedUsers.length === 0) {
        setError('Please select at least one user or choose "Apply to all users"');
        setSaving(prev => ({ ...prev, bulk: false }));
        return;
      }

      const payload = {
        featurePermissions: bulkSettings.featurePermissions,
        applyToAll: bulkDialog.applyToAll,
        userIds: bulkDialog.applyToAll ? [] : bulkDialog.selectedUsers
      };

      const response = await api.put('/admin/manage/bulk', payload);
      
      // Refresh the user data
      await fetchUsers();
      
      setSuccess(`Successfully updated ${response.data.modifiedCount} users`);
      setTimeout(() => setSuccess(null), 3000);
      setBulkDialog({ open: false, selectedUsers: [], applyToAll: false });
    } catch (err) {
      console.error('Error applying bulk settings:', err);
      const errorMessage = err.response?.data?.error || 'Failed to apply bulk settings';
      setError(errorMessage);
    } finally {
      setSaving(prev => ({ ...prev, bulk: false }));
    }
  }, [bulkSettings, bulkDialog, fetchUsers]);

  const handleUpdateGracePeriod = useCallback(async () => {
    const value = Number(graceDialog.value);
    if (isNaN(value) || value < 0 || value > 1440) {
      setError('Grace period must be between 0 and 1440 minutes');
      return;
    }
    try {
      setUpdatingGrace(true);
      setError(null);
      await api.put('/analytics/late-grace-settings', { minutes: value });
      setGracePeriodMinutes(value);
      setGraceDialog({ open: false, value });
      setSuccess('Grace period updated successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update grace period:', err);
      setError(err.response?.data?.error || 'Failed to update grace period');
    } finally {
      setUpdatingGrace(false);
    }
  }, [graceDialog.value]);

  // Handle permission change (no auto-save)
  const handlePermissionChange = useCallback((userId, path, value) => {
    setUsers(prev => {
      const user = prev.find(u => u._id === userId);
      if (!user) return prev;

      const newPermissions = { ...user.featurePermissions };
      
      // Handle nested object updates
      if (path.includes('.')) {
        const [parent, child] = path.split('.');
        if (!newPermissions[parent]) newPermissions[parent] = {};
        newPermissions[parent][child] = value;
      } else {
        newPermissions[path] = value;
      }

      // Update local state only (no auto-save)
      return prev.map(u => 
        u._id === userId 
          ? { ...u, featurePermissions: newPermissions }
          : u
      );
    });

    // Mark as having unsaved changes
    setUnsavedChanges(prev => ({ ...prev, [userId]: true }));
  }, []);

  // Get privilege level color
  const getPrivilegeColor = useCallback((level) => {
    switch (level || 'normal') {
      case 'restricted': return 'error';
      case 'normal': return 'primary';
      case 'advanced': return 'success';
      default: return 'default';
    }
  }, []);

  // Get privilege level icon
  const getPrivilegeIcon = useCallback((level) => {
    switch (level || 'normal') {
      case 'restricted': return <BlockIcon />;
      case 'normal': return <CheckCircleIcon />;
      case 'advanced': return <SecurityIcon />;
      default: return <PersonIcon />;
    }
  }, []);

  // Render permission controls for a user
  const renderUserPermissions = useCallback((user) => {
    // Get the current user from state to ensure we have the latest data
    const currentUser = users.find(u => u._id === user._id) || user;
    const { featurePermissions } = currentUser;
    
    // Ensure featurePermissions has all required fields with defaults
    const safeFeaturePermissions = {
      leaves: true,
      breaks: true,
      extraFeatures: false,
      maxBreaks: 999,
      breakAfterHours: 0,
      breakWindows: featurePermissions?.breakWindows || [],
      canCheckIn: true,
      canCheckOut: true,
      canTakeBreak: true,
      canViewAnalytics: false, // New field for analytics access
      privilegeLevel: 'normal',
      // Merge existing values from featurePermissions while adding defaults
      ...featurePermissions,
      // Ensure nested objects are properly merged with defaults
      restrictedFeatures: {
        canViewReports: false,
        canViewOtherLogs: false,
        canEditProfile: true,
        canRequestExtraBreak: true,
        ...(featurePermissions?.restrictedFeatures || {})
      },
      advancedFeatures: {
        canBulkActions: false,
        canExportData: false,
        ...(featurePermissions?.advancedFeatures || {})
      },
      autoBreakOnInactivity: false,
      inactivityThresholdMinutes: 5,
      ...(featurePermissions?.autoBreakOnInactivity !== undefined && { autoBreakOnInactivity: featurePermissions.autoBreakOnInactivity }),
      ...(featurePermissions?.inactivityThresholdMinutes !== undefined && { inactivityThresholdMinutes: featurePermissions.inactivityThresholdMinutes })
    };
    
    const breakWindowCount = safeFeaturePermissions.breakWindows?.length || 0;
    const enabledCoreFeatures = [
      safeFeaturePermissions.leaves,
      safeFeaturePermissions.breaks,
      safeFeaturePermissions.extraFeatures
    ].filter(Boolean).length;
    const quickStats = [
      { label: 'Privilege Level', value: (safeFeaturePermissions.privilegeLevel || 'normal').toUpperCase() },
      { label: 'Break Windows', value: breakWindowCount },
      { label: 'Core Features Enabled', value: `${enabledCoreFeatures}/3` },
      { 
        label: 'Auto Break', 
        value: safeFeaturePermissions.autoBreakOnInactivity 
          ? `${safeFeaturePermissions.inactivityThresholdMinutes || 5} min`
          : 'Disabled' 
      }
    ];

    return (
      <>
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 3,
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #e53935 0%, #b71c1c 100%)',
            boxShadow: '0 30px 60px rgba(183, 28, 28, 0.35)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
            <Avatar
              sx={{
                width: 72,
                height: 72,
                fontSize: '1.75rem',
                fontWeight: 700,
                backgroundColor: 'rgba(255,255,255,0.2)'
              }}
            >
              {currentUser.fullName.charAt(0).toUpperCase()}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography variant="overline" sx={{ letterSpacing: 1.5, opacity: 0.8 }}>
                MANAGE PERMISSIONS
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {currentUser.fullName}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                {currentUser.employeeCode} • {currentUser.role}
              </Typography>
            </Box>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ flex: 1, minWidth: 240 }}
            >
              {quickStats.map((stat) => (
                <Box
                  key={stat.label}
                  sx={{
                    flex: 1,
                    borderRadius: '18px',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(6px)'
                  }}
                >
                  <Typography variant="caption" sx={{ letterSpacing: 1, opacity: 0.8 }}>
                    {stat.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {stat.value}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Chip
              label={safeFeaturePermissions.canViewAnalytics ? 'Analytics Enabled' : 'Analytics Disabled'}
              color={safeFeaturePermissions.canViewAnalytics ? 'success' : 'default'}
              sx={{
                px: 2,
                height: 36,
                fontWeight: 600,
                backgroundColor: safeFeaturePermissions.canViewAnalytics
                  ? 'rgba(76, 175, 80, 0.2)'
                  : 'rgba(255,255,255,0.2)',
                color: '#fff',
                borderRadius: '18px',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}
            />
          </Box>
        </Paper>

        <Grid container spacing={3}>
        {/* Core Features */}
        <Grid xs={12} md={6}>
          <Paper 
            elevation={0} 
            sx={createCardStyles('rgba(229, 57, 53, 0.14)')}
          >
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#e53935',
                fontWeight: 700,
                borderBottom: '2px solid rgba(229, 57, 53, 0.2)',
                paddingBottom: 1,
                marginBottom: 2,
                letterSpacing: 0.5
              }}
            >
              <SettingsIcon sx={{ color: '#e53935' }} />
              Core Features
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Leaves Section</Typography>
                <Switch
                  checked={safeFeaturePermissions.leaves}
                  onChange={(e) => handlePermissionChange(currentUser._id, 'leaves', e.target.checked)}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Breaks Section</Typography>
                <Switch
                  checked={safeFeaturePermissions.breaks}
                  onChange={(e) => handlePermissionChange(currentUser._id, 'breaks', e.target.checked)}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Extra Features</Typography>
                <Switch
                  checked={safeFeaturePermissions.extraFeatures}
                  onChange={(e) => handlePermissionChange(currentUser._id, 'extraFeatures', e.target.checked)}
                />
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Break Timing Configuration */}
        <Grid xs={12} md={6}>
          <Paper 
            elevation={0} 
            sx={createCardStyles('rgba(33, 150, 243, 0.16)')}
          >
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#0d47a1',
                fontWeight: 700,
                borderBottom: '2px solid rgba(13, 71, 161, 0.2)',
                paddingBottom: 1,
                marginBottom: 2,
                letterSpacing: 0.5
              }}
            >
              <AccessTimeIcon sx={{ color: '#0d47a1' }} />
              Break Timing Configuration
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {safeFeaturePermissions.breakWindows?.map((window, index) => (
                <Box key={index} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">Break Window {index + 1}</Typography>
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        const newWindows = [...(safeFeaturePermissions.breakWindows || [])];
                        newWindows.splice(index, 1);
                        handlePermissionChange(currentUser._id, 'breakWindows', newWindows);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid xs={6}>
                      {/* --- MODIFIED: Break Type Dropdown --- */}
                      <FormControl fullWidth size="small">
                        <InputLabel>Break Type</InputLabel>
                        <Select
                          value={window.type || 'Paid'}
                          label="Break Type"
                          onChange={(e) => {
                            const newWindows = [...(safeFeaturePermissions.breakWindows || [])];
                            newWindows[index] = { ...window, type: e.target.value };
                            handlePermissionChange(currentUser._id, 'breakWindows', newWindows);
                          }}
                        >
                          <MenuItem value="Paid">Paid Break</MenuItem>
                          <MenuItem value="Unpaid">Unpaid Break</MenuItem>
                          <MenuItem value="Extra">Extra Break</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Window Name (e.g. Lunch)"
                        value={window.name || ''}
                        onChange={(e) => {
                          const newWindows = [...(safeFeaturePermissions.breakWindows || [])];
                          newWindows[index] = { ...window, name: e.target.value };
                          handlePermissionChange(currentUser._id, 'breakWindows', newWindows);
                        }}
                      />
                    </Grid>
                    <Grid xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Start Time"
                        type="time"
                        value={window.startTime || '09:00'}
                        onChange={(e) => {
                          const newWindows = [...(safeFeaturePermissions.breakWindows || [])];
                          newWindows[index] = { ...window, startTime: e.target.value };
                          handlePermissionChange(currentUser._id, 'breakWindows', newWindows);
                        }}
                      />
                    </Grid>
                    <Grid xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="End Time"
                        type="time"
                        value={window.endTime || '17:00'}
                        onChange={(e) => {
                          const newWindows = [...(safeFeaturePermissions.breakWindows || [])];
                          newWindows[index] = { ...window, endTime: e.target.value };
                          handlePermissionChange(currentUser._id, 'breakWindows', newWindows);
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              ))}
              
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  const newWindows = [...(safeFeaturePermissions.breakWindows || []), {
                    type: 'Paid',
                    name: 'New Break Window',
                    startTime: '09:00',
                    endTime: '17:00',
                    isActive: true
                  }];
                  handlePermissionChange(currentUser._id, 'breakWindows', newWindows);
                }}
                sx={{ mt: 1 }}
              >
                Add Break Window
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* UI Controls */}
        <Grid xs={12} md={6}>
          <Paper 
            elevation={0} 
            sx={createCardStyles('rgba(244, 143, 177, 0.18)')}
          >
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#e53935',
                fontWeight: 600,
                borderBottom: '2px solid #e53935',
                paddingBottom: 1,
                marginBottom: 2
              }}
            >
              <SettingsIcon sx={{ color: '#e53935' }} />
              UI Controls
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Can Check In</Typography>
                <Switch
                  checked={safeFeaturePermissions.canCheckIn}
                  onChange={(e) => handlePermissionChange(currentUser._id, 'canCheckIn', e.target.checked)}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Can Check Out</Typography>
                <Switch
                  checked={safeFeaturePermissions.canCheckOut}
                  onChange={(e) => handlePermissionChange(currentUser._id, 'canCheckOut', e.target.checked)}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Can Take Break</Typography>
                <Switch
                  checked={safeFeaturePermissions.canTakeBreak}
                  onChange={(e) => handlePermissionChange(currentUser._id, 'canTakeBreak', e.target.checked)}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Can View Analytics
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Access to analytics dashboard and reports
                  </Typography>
                </Box>
                <Switch
                  checked={safeFeaturePermissions.canViewAnalytics}
                  onChange={(e) => handlePermissionChange(currentUser._id, 'canViewAnalytics', e.target.checked)}
                />
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Auto-Break on Inactivity */}
        <Grid xs={12} md={6}>
          <Paper 
            elevation={0} 
            sx={createCardStyles('rgba(76, 175, 80, 0.18)')}
          >
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#e53935',
                fontWeight: 600,
                borderBottom: '2px solid #e53935',
                paddingBottom: 1,
                marginBottom: 2
              }}
            >
              <AccessTimeIcon sx={{ color: '#e53935' }} />
              Auto-Break on Inactivity
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Enable Auto-Unpaid-Break
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically place user on unpaid break after inactivity
                  </Typography>
                </Box>
                <Switch
                  checked={safeFeaturePermissions.autoBreakOnInactivity || false}
                  onChange={(e) => handlePermissionChange(currentUser._id, 'autoBreakOnInactivity', e.target.checked)}
                />
              </Box>
              
              {safeFeaturePermissions.autoBreakOnInactivity && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Inactivity Threshold (minutes)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Time of inactivity before auto-break triggers
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    type="number"
                    value={safeFeaturePermissions.inactivityThresholdMinutes || 5}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(60, parseInt(e.target.value) || 5));
                      handlePermissionChange(currentUser._id, 'inactivityThresholdMinutes', value);
                    }}
                    inputProps={{ min: 1, max: 60 }}
                    sx={{ width: 80 }}
                  />
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Privilege Level */}
        <Grid xs={12} md={6}>
          <Paper 
            elevation={0} 
            sx={createCardStyles('rgba(255, 193, 7, 0.18)')}
          >
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#e53935',
                fontWeight: 600,
                borderBottom: '2px solid #e53935',
                paddingBottom: 1,
                marginBottom: 2
              }}
            >
              <SecurityIcon sx={{ color: '#e53935' }} />
              Privilege Level
            </Typography>
            
            <FormControl fullWidth size="small">
              <InputLabel>Privilege Level</InputLabel>
              <Select
                value={safeFeaturePermissions.privilegeLevel || 'normal'}
                onChange={(e) => handlePermissionChange(currentUser._id, 'privilegeLevel', e.target.value)}
                disabled={saving[currentUser._id]}
                label="Privilege Level"
              >
                <MenuItem value="restricted">Restricted</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="advanced">Advanced</MenuItem>
              </Select>
            </FormControl>
          </Paper>
        </Grid>

        {/* Restricted Features */}
        {safeFeaturePermissions.privilegeLevel === 'restricted' && (
          <Grid xs={12}>
            <Paper 
              elevation={0} 
              sx={createCardStyles('rgba(255, 167, 38, 0.2)')}
            >
              <Typography 
                variant="h6" 
                gutterBottom 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  color: '#e53935',
                  fontWeight: 600,
                  borderBottom: '2px solid #e53935',
                  paddingBottom: 1,
                  marginBottom: 2
                }}
              >
                <WarningIcon sx={{ color: '#e53935' }} />
                Restricted Features
              </Typography>
              
              <Grid container spacing={2}>
                <Grid xs={12} sm={6}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Can View Reports</Typography>
                    <Switch
                      checked={safeFeaturePermissions.restrictedFeatures.canViewReports}
                      onChange={(e) => handlePermissionChange(currentUser._id, 'restrictedFeatures.canViewReports', e.target.checked)}
                    />
                  </Box>
                </Grid>
                
                <Grid xs={12} sm={6}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Can View Other Logs</Typography>
                    <Switch
                      checked={safeFeaturePermissions.restrictedFeatures.canViewOtherLogs}
                      onChange={(e) => handlePermissionChange(currentUser._id, 'restrictedFeatures.canViewOtherLogs', e.target.checked)}
                    />
                  </Box>
                </Grid>
                
                <Grid xs={12} sm={6}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Can Edit Profile</Typography>
                    <Switch
                      checked={safeFeaturePermissions.restrictedFeatures.canEditProfile}
                      onChange={(e) => handlePermissionChange(currentUser._id, 'restrictedFeatures.canEditProfile', e.target.checked)}
                    />
                  </Box>
                </Grid>
                
                <Grid xs={12} sm={6}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Can Request Extra Break</Typography>
                    <Switch
                      checked={safeFeaturePermissions.restrictedFeatures.canRequestExtraBreak}
                      onChange={(e) => handlePermissionChange(currentUser._id, 'restrictedFeatures.canRequestExtraBreak', e.target.checked)}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Advanced Features */}
        {safeFeaturePermissions.privilegeLevel === 'advanced' && (
          <Grid xs={12}>
            <Paper 
              elevation={0} 
              sx={createCardStyles('rgba(57, 73, 171, 0.18)')}
            >
              <Typography 
                variant="h6" 
                gutterBottom 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  color: '#e53935',
                  fontWeight: 600,
                  borderBottom: '2px solid #e53935',
                  paddingBottom: 1,
                  marginBottom: 2
                }}
              >
                <SecurityIcon sx={{ color: '#e53935' }} />
                Advanced Features
              </Typography>
              
              <Grid container spacing={2}>
                <Grid xs={12} sm={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Bulk Actions</Typography>
                    <Switch
                      checked={safeFeaturePermissions.advancedFeatures.canBulkActions}
                      onChange={(e) => handlePermissionChange(currentUser._id, 'advancedFeatures.canBulkActions', e.target.checked)}
                    />
                  </Box>
                </Grid>
                
                <Grid xs={12} sm={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Export Data</Typography>
                    <Switch
                      checked={safeFeaturePermissions.advancedFeatures.canExportData}
                      onChange={(e) => handlePermissionChange(currentUser._id, 'advancedFeatures.canExportData', e.target.checked)}
                    />
                  </Box>
                </Grid>
                
                <Grid xs={12} sm={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">View Analytics</Typography>
                    <Switch
                      checked={safeFeaturePermissions.advancedFeatures.canViewAnalytics}
                      onChange={(e) => handlePermissionChange(currentUser._id, 'advancedFeatures.canViewAnalytics', e.target.checked)}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}
        </Grid>
      </>
    );
  }, [users, handlePermissionChange, saving]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className="manage-section-page">
      <PageHeroHeader
        eyebrow="Access Controls"
        title="Manage Section"
        description="Configure feature access, bulk update permissions, and maintain compliance-ready user roles."
        actionArea={
          <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="flex-start">
            <Button 
              variant="contained" 
              startIcon={<RefreshIcon />} 
              onClick={fetchUsers}
              sx={{
                background: 'linear-gradient(135deg, #e53935 0%, #d32f2f 100%)',
                borderRadius: '25px',
                padding: '8px 20px',
                fontWeight: 600,
                textTransform: 'none',
                color: 'white',
                boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                  boxShadow: '0 6px 16px rgba(229, 57, 53, 0.4)',
                }
              }}
            >
              Refresh
            </Button>
            <IconButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{
                background: 'linear-gradient(135deg, #e53935 0%, #d32f2f 100%)',
                borderRadius: '25px',
                padding: '8px',
                color: 'white',
                boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                  boxShadow: '0 6px 16px rgba(229, 57, 53, 0.4)',
                }
              }}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem
                onClick={() => {
                  setBulkDialog({ open: true, selectedUsers: [], applyToAll: false });
                  setMenuAnchor(null);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  padding: '10px 20px'
                }}
              >
                <GroupIcon sx={{ color: '#e53935' }} />
                Bulk Update
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setGraceDialog({ open: true, value: gracePeriodMinutes });
                  setMenuAnchor(null);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  padding: '10px 20px'
                }}
              >
                <AccessTimeIcon sx={{ color: '#e53935' }} />
                Update Grace Period ({gracePeriodMinutes} min)
              </MenuItem>
            </Menu>
          </Stack>
        }
      />

      {error && <Alert severity="error" className="error-alert">{error}</Alert>}
      {success && <Alert severity="success" className="error-alert">{success}</Alert>}

      <Box className="manage-section-overview">
        {[
          {
            label: 'Total Users',
            value: users.length,
            helper: `${adminRoleCount} admin${adminRoleCount === 1 ? '' : 's'}`,
            icon: <PeopleAltIcon />,
          },
          {
            label: 'Advanced Privileges',
            value: advancedPrivilegeCount,
            helper: 'High-trust users',
            icon: <SecurityIcon />,
          },
          {
            label: 'Analytics Access',
            value: analyticsEnabledCount,
            helper: 'Can view dashboards',
            icon: <InsightsIcon />,
          },
          {
            label: 'Unsaved Changes',
            value: unsavedCount,
            helper: unsavedCount ? 'Review & save' : 'All synced',
            icon: <RestartAltIcon />,
          },
        ].map((stat) => (
          <Card key={stat.label} className="overview-card">
            <CardContent>
              <Box className="overview-card__icon">{stat.icon}</Box>
              <Typography className="overview-card__label" variant="body2">
                {stat.label}
              </Typography>
              <Typography className="overview-card__value" variant="h4">
                {stat.value}
              </Typography>
              <Typography className="overview-card__helper" variant="caption">
                {stat.helper}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box className="manage-section-toolbar">
        <TextField
          placeholder="Search name, email, or employee code"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Role</InputLabel>
          <Select
            label="Role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <MenuItem value="all">All roles</MenuItem>
            {roleOptions.map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Privilege</InputLabel>
          <Select
            label="Privilege"
            value={selectedPrivilege}
            onChange={(e) => setSelectedPrivilege(e.target.value)}
          >
            <MenuItem value="all">All levels</MenuItem>
            {privilegeOptions.map((privilege) => (
              <MenuItem key={privilege} value={privilege}>
                {privilege.charAt(0).toUpperCase() + privilege.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={showUnsavedOnly}
              onChange={(e) => setShowUnsavedOnly(e.target.checked)}
            />
          }
          label="Unsaved only"
        />
      </Box>

      {/* User Cards Grid */}
      <div className="users-grid-container">
        {filteredUsers.length === 0 && (
          <Paper className="empty-users">
            <Typography variant="h6">No team members found</Typography>
            <Typography variant="body2" color="text.secondary">
              Adjust your filters or clear the search to view more users.
            </Typography>
          </Paper>
        )}
        {filteredUsers.map((user) => (
          <Card 
            key={user._id} 
            className="user-card"
            onClick={() => setUserModal({ open: true, user })}
          >
            <CardContent className="user-card-content">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar 
                  sx={{ 
                    width: 48, 
                    height: 48, 
                    background: 'linear-gradient(135deg, #e53935 0%, #d32f2f 100%)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '1.2rem'
                  }}
                >
                  {user.fullName.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" className="user-name">
                    {user.fullName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" className="user-details">
                    {user.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" className="user-details">
                    {user.employeeCode} • {user.role}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Chip
                  icon={getPrivilegeIcon(user.featurePermissions?.privilegeLevel)}
                  label={user.featurePermissions?.privilegeLevel || 'normal'}
                  size="small"
                  sx={{
                    background: 'linear-gradient(135deg, #e53935 0%, #d32f2f 100%)',
                    color: 'white',
                    fontWeight: 600,
                    border: 'none',
                    '& .MuiChip-icon': {
                      color: 'white'
                    }
                  }}
                />
                {hasUnsavedChanges(user._id) && (
                  <Chip
                    label="Unsaved"
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: '#e53935',
                      color: '#e53935',
                      backgroundColor: 'rgba(229, 57, 53, 0.1)',
                      fontWeight: 500
                    }}
                  />
                )}
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Click to manage permissions
                </Typography>
                {saving[user._id] && <CircularProgress size={16} />}
              </Box>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User Management Modal */}
      <Dialog 
        open={userModal.open} 
        onClose={() => setUserModal({ open: false, user: null })} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }
        }}
      >
        {/* Custom Header with Red Background */}
        <Box 
          sx={{ 
            background: 'linear-gradient(135deg, #e53935 0%, #d32f2f 100%)',
            color: 'white',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          <PersonIcon sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, margin: 0 }}>
              Manage Permissions
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, margin: 0 }}>
              {userModal.user?.fullName}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Reset to defaults">
            <IconButton
              onClick={() => setResetDialog({ open: true, userId: userModal.user?._id, userName: userModal.user?.fullName })}
              sx={{ 
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <DialogContent sx={{ padding: 0, backgroundColor: '#f8f9fa' }}>
          {userModal.user && (
            <Box sx={{ padding: '24px' }}>
              {renderUserPermissions(userModal.user)}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ 
          padding: '20px 24px', 
          backgroundColor: 'white',
          borderTop: '1px solid #e0e0e0',
          gap: 2
        }}>
          <Button 
            onClick={() => setUserModal({ open: false, user: null })}
            variant="outlined"
            sx={{ 
              borderColor: '#bdbdbd',
              color: '#757575',
              '&:hover': {
                borderColor: '#9e9e9e',
                backgroundColor: '#f5f5f5'
              }
            }}
          >
            Close
          </Button>
          {userModal.user && hasUnsavedChanges(userModal.user._id) && (
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => saveUserPermissions(userModal.user._id)}
              disabled={saving[userModal.user._id]}
              sx={{
                background: 'linear-gradient(135deg, #e53935 0%, #d32f2f 100%)',
                borderRadius: '25px',
                padding: '8px 24px',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                  boxShadow: '0 6px 16px rgba(229, 57, 53, 0.4)',
                },
                '&:disabled': {
                  background: '#bdbdbd',
                  boxShadow: 'none'
                }
              }}
            >
              {saving[userModal.user._id] ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialog.open} onClose={() => setResetDialog({ open: false, userId: null, userName: '' })}>
        <DialogTitle>Reset Permissions</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to reset permissions for <strong>{resetDialog.userName}</strong> to default values?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialog({ open: false, userId: null, userName: '' })}>
            Cancel
          </Button>
          <Button
            onClick={() => resetUserPermissions(resetDialog.userId)}
            color="warning"
            variant="contained"
            disabled={saving[resetDialog.userId]}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Operations Dialog */}
      <Dialog 
        open={bulkDialog.open} 
        onClose={() => setBulkDialog({ open: false, selectedUsers: [], applyToAll: false })} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }
        }}
      >
        {/* Custom Header with Red Background */}
        <Box 
          sx={{ 
            background: 'linear-gradient(135deg, #e53935 0%, #d32f2f 100%)',
            color: 'white',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          <GroupIcon sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, margin: 0 }}>
              {bulkDialog.applyToAll ? 'Apply Settings to All Users' : 'Apply Settings to Selected Users'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, margin: 0 }}>
              Configure permissions for multiple users at once
            </Typography>
          </Box>
        </Box>

        <DialogContent sx={{ padding: 0, backgroundColor: '#f8f9fa' }}>
          <Box sx={{ padding: '24px' }}>
            {/* User Selection Section */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3,
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                mb: 3
              }}
            >
              <Typography 
                variant="h6" 
                gutterBottom 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  color: '#e53935',
                  fontWeight: 600,
                  borderBottom: '2px solid #e53935',
                  paddingBottom: 1,
                  marginBottom: 2
                }}
              >
                <GroupIcon sx={{ color: '#e53935' }} />
                Select Users
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Switch
                    checked={bulkDialog.applyToAll}
                    onChange={(e) => setBulkDialog(prev => ({ 
                      ...prev, 
                      applyToAll: e.target.checked,
                      selectedUsers: e.target.checked ? [] : prev.selectedUsers
                    }))}
                  />
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Apply to all users
                  </Typography>
                </Box>
                
                {!bulkDialog.applyToAll && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Select specific users to apply these settings to:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setBulkDialog(prev => ({
                              ...prev,
                              selectedUsers: users.map(u => u._id)
                            }));
                          }}
                          sx={{ 
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            padding: '4px 8px'
                          }}
                        >
                          Select All
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setBulkDialog(prev => ({
                              ...prev,
                              selectedUsers: []
                            }));
                          }}
                          sx={{ 
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            padding: '4px 8px'
                          }}
                        >
                          Deselect All
                        </Button>
                      </Box>
                    </Box>
                    <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                      {users.map((user) => (
                        <Box key={user._id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
                          <Checkbox
                            checked={bulkDialog.selectedUsers.includes(user._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBulkDialog(prev => ({
                                  ...prev,
                                  selectedUsers: [...prev.selectedUsers, user._id]
                                }));
                              } else {
                                setBulkDialog(prev => ({
                                  ...prev,
                                  selectedUsers: prev.selectedUsers.filter(id => id !== user._id)
                                }));
                              }
                            }}
                            size="small"
                            sx={{ 
                              color: '#e53935',
                              '&.Mui-checked': {
                                color: '#e53935',
                              }
                            }}
                          />
                          <Typography variant="body2" sx={{ cursor: 'pointer', flex: 1 }} onClick={() => {
                            const isSelected = bulkDialog.selectedUsers.includes(user._id);
                            if (isSelected) {
                              setBulkDialog(prev => ({
                                ...prev,
                                selectedUsers: prev.selectedUsers.filter(id => id !== user._id)
                              }));
                            } else {
                              setBulkDialog(prev => ({
                                ...prev,
                                selectedUsers: [...prev.selectedUsers, user._id]
                              }));
                            }
                          }}>
                            {user.fullName} ({user.employeeCode})
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {bulkDialog.selectedUsers.length} user(s) selected
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            <Paper 
              elevation={0} 
              sx={{ 
                p: 3,
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                mb: 3
              }}
            >
              <Typography 
                variant="h6" 
                gutterBottom 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  color: '#e53935',
                  fontWeight: 600,
                  borderBottom: '2px solid #e53935',
                  paddingBottom: 1,
                  marginBottom: 2
                }}
              >
                <SettingsIcon sx={{ color: '#e53935' }} />
                Feature Permissions
              </Typography>
            
            <Grid container spacing={2}>
              <Grid xs={6}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Leaves Section</Typography>
                  <Switch
                    checked={bulkSettings.featurePermissions.leaves}
                    onChange={(e) => setBulkSettings(prev => ({
                      ...prev,
                      featurePermissions: { ...prev.featurePermissions, leaves: e.target.checked }
                    }))}
                  />
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Breaks Section</Typography>
                  <Switch
                    checked={bulkSettings.featurePermissions.breaks}
                    onChange={(e) => setBulkSettings(prev => ({
                      ...prev,
                      featurePermissions: { ...prev.featurePermissions, breaks: e.target.checked }
                    }))}
                  />
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Extra Features</Typography>
                  <Switch
                    checked={bulkSettings.featurePermissions.extraFeatures}
                    onChange={(e) => setBulkSettings(prev => ({
                      ...prev,
                      featurePermissions: { ...prev.featurePermissions, extraFeatures: e.target.checked }
                    }))}
                  />
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Auto-Break on Inactivity</Typography>
                  <Switch
                    checked={bulkSettings.featurePermissions.autoBreakOnInactivity}
                    onChange={(e) => setBulkSettings(prev => ({
                      ...prev,
                      featurePermissions: { ...prev.featurePermissions, autoBreakOnInactivity: e.target.checked }
                    }))}
                  />
                </Box>
              </Grid>
            </Grid>

            {/* Numeric Fields */}
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Break Settings</Typography>
            <Grid container spacing={2}>
              <Grid xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Max Breaks"
                  type="number"
                  value={bulkSettings.featurePermissions.maxBreaks}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    featurePermissions: { ...prev.featurePermissions, maxBreaks: parseInt(e.target.value) || 0 }
                  }))}
                  inputProps={{ min: 0, max: 999 }}
                />
              </Grid>
              <Grid xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Break After Hours"
                  type="number"
                  value={bulkSettings.featurePermissions.breakAfterHours}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    featurePermissions: { ...prev.featurePermissions, breakAfterHours: parseFloat(e.target.value) || 0 }
                  }))}
                  inputProps={{ min: 0, max: 24, step: 0.5 }}
                />
              </Grid>
            </Grid>

            {/* Inactivity Threshold */}
            {bulkSettings.featurePermissions.autoBreakOnInactivity && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Inactivity Threshold (minutes)"
                  type="number"
                  value={bulkSettings.featurePermissions.inactivityThresholdMinutes}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    featurePermissions: { ...prev.featurePermissions, inactivityThresholdMinutes: Math.max(1, Math.min(60, parseInt(e.target.value) || 5)) }
                  }))}
                  inputProps={{ min: 1, max: 60 }}
                />
              </Box>
            )}

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Break Windows</Typography>
            {bulkSettings.featurePermissions.breakWindows?.map((window, index) => (
              <Box key={index} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">Break Window {index + 1}</Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      const newWindows = [...bulkSettings.featurePermissions.breakWindows];
                      newWindows.splice(index, 1);
                      setBulkSettings(prev => ({
                        ...prev,
                        featurePermissions: { ...prev.featurePermissions, breakWindows: newWindows }
                      }));
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                
                <Grid container spacing={2}>
                  <Grid xs={6}>
                    {/* --- MODIFIED: Break Type Dropdown in Bulk Dialog --- */}
                    <FormControl fullWidth size="small">
                      <InputLabel>Break Type</InputLabel>
                      <Select
                        value={window.type || 'Paid'}
                        label="Break Type"
                        onChange={(e) => {
                          const newWindows = [...bulkSettings.featurePermissions.breakWindows];
                          newWindows[index] = { ...window, type: e.target.value };
                          setBulkSettings(prev => ({
                            ...prev,
                            featurePermissions: { ...prev.featurePermissions, breakWindows: newWindows }
                          }));
                        }}
                      >
                        <MenuItem value="Paid">Paid Break</MenuItem>
                        <MenuItem value="Unpaid">Unpaid Break</MenuItem>
                        <MenuItem value="Extra">Extra Break</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Window Name"
                      value={window.name || ''}
                      onChange={(e) => {
                        const newWindows = [...bulkSettings.featurePermissions.breakWindows];
                        newWindows[index] = { ...window, name: e.target.value };
                        setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { ...prev.featurePermissions, breakWindows: newWindows }
                        }));
                      }}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Start Time"
                      type="time"
                      value={window.startTime || '09:00'}
                      onChange={(e) => {
                        const newWindows = [...bulkSettings.featurePermissions.breakWindows];
                        newWindows[index] = { ...window, startTime: e.target.value };
                        setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { ...prev.featurePermissions, breakWindows: newWindows }
                        }));
                      }}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="End Time"
                      type="time"
                      value={window.endTime || '17:00'}
                      onChange={(e) => {
                        const newWindows = [...bulkSettings.featurePermissions.breakWindows];
                        newWindows[index] = { ...window, endTime: e.target.value };
                        setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { ...prev.featurePermissions, breakWindows: newWindows }
                        }));
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
            
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                const newWindows = [...(bulkSettings.featurePermissions.breakWindows || []), {
                  type: 'Paid',
                  name: 'New Break Window',
                  startTime: '09:00',
                  endTime: '17:00',
                  isActive: true
                }];
                setBulkSettings(prev => ({
                  ...prev,
                  featurePermissions: { ...prev.featurePermissions, breakWindows: newWindows }
                }));
              }}
              sx={{ mt: 1 }}
            >
              Add Break Window
            </Button>
            </Paper>

            {/* UI Controls */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3,
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                mb: 3
              }}
            >
              <Typography 
                variant="h6" 
                gutterBottom 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  color: '#e53935',
                  fontWeight: 600,
                  borderBottom: '2px solid #e53935',
                  paddingBottom: 1,
                  marginBottom: 2
                }}
              >
                <SettingsIcon sx={{ color: '#e53935' }} />
                UI Controls
              </Typography>
              
              <Grid container spacing={2}>
                <Grid xs={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Can Check In</Typography>
                    <Switch
                      checked={bulkSettings.featurePermissions.canCheckIn}
                      onChange={(e) => setBulkSettings(prev => ({
                        ...prev,
                        featurePermissions: { ...prev.featurePermissions, canCheckIn: e.target.checked }
                      }))}
                    />
                  </Box>
                </Grid>
                <Grid xs={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Can Check Out</Typography>
                    <Switch
                      checked={bulkSettings.featurePermissions.canCheckOut}
                      onChange={(e) => setBulkSettings(prev => ({
                        ...prev,
                        featurePermissions: { ...prev.featurePermissions, canCheckOut: e.target.checked }
                      }))}
                    />
                  </Box>
                </Grid>
                <Grid xs={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Can Take Break</Typography>
                    <Switch
                      checked={bulkSettings.featurePermissions.canTakeBreak}
                      onChange={(e) => setBulkSettings(prev => ({
                        ...prev,
                        featurePermissions: { ...prev.featurePermissions, canTakeBreak: e.target.checked }
                      }))}
                    />
                  </Box>
                </Grid>
              </Grid>
              
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Can View Analytics
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Access to analytics dashboard and reports
                      </Typography>
                    </Box>
                    <Switch
                      checked={bulkSettings.featurePermissions.canViewAnalytics}
                      onChange={(e) => setBulkSettings(prev => ({
                        ...prev,
                        featurePermissions: { ...prev.featurePermissions, canViewAnalytics: e.target.checked }
                      }))}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Privilege Level */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3,
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                mb: 3
              }}
            >
              <Typography 
                variant="h6" 
                gutterBottom 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  color: '#e53935',
                  fontWeight: 600,
                  borderBottom: '2px solid #e53935',
                  paddingBottom: 1,
                  marginBottom: 2
                }}
              >
                <SecurityIcon sx={{ color: '#e53935' }} />
                Privilege Level
              </Typography>
              
              <FormControl fullWidth size="small">
                <InputLabel>Privilege Level</InputLabel>
                <Select
                  value={bulkSettings.featurePermissions.privilegeLevel}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    featurePermissions: { ...prev.featurePermissions, privilegeLevel: e.target.value }
                  }))}
                  label="Privilege Level"
                >
                  <MenuItem value="restricted">Restricted</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>
            </Paper>

            {/* Restricted Features - Only show when privilege level is restricted */}
            {bulkSettings.featurePermissions.privilegeLevel === 'restricted' && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3,
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  mb: 3
                }}
              >
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    color: '#e53935',
                    fontWeight: 600,
                    borderBottom: '2px solid #e53935',
                    paddingBottom: 1,
                    marginBottom: 2
                  }}
                >
                  <WarningIcon sx={{ color: '#e53935' }} />
                  Restricted Features
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Can View Reports</Typography>
                      <Switch
                        checked={bulkSettings.featurePermissions.restrictedFeatures.canViewReports}
                        onChange={(e) => setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { 
                            ...prev.featurePermissions, 
                            restrictedFeatures: {
                              ...prev.featurePermissions.restrictedFeatures,
                              canViewReports: e.target.checked
                            }
                          }
                        }))}
                      />
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Can View Other Logs</Typography>
                      <Switch
                        checked={bulkSettings.featurePermissions.restrictedFeatures.canViewOtherLogs}
                        onChange={(e) => setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { 
                            ...prev.featurePermissions, 
                            restrictedFeatures: {
                              ...prev.featurePermissions.restrictedFeatures,
                              canViewOtherLogs: e.target.checked
                            }
                          }
                        }))}
                      />
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Can Edit Profile</Typography>
                      <Switch
                        checked={bulkSettings.featurePermissions.restrictedFeatures.canEditProfile}
                        onChange={(e) => setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { 
                            ...prev.featurePermissions, 
                            restrictedFeatures: {
                              ...prev.featurePermissions.restrictedFeatures,
                              canEditProfile: e.target.checked
                            }
                          }
                        }))}
                      />
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Can Request Extra Break</Typography>
                      <Switch
                        checked={bulkSettings.featurePermissions.restrictedFeatures.canRequestExtraBreak}
                        onChange={(e) => setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { 
                            ...prev.featurePermissions, 
                            restrictedFeatures: {
                              ...prev.featurePermissions.restrictedFeatures,
                              canRequestExtraBreak: e.target.checked
                            }
                          }
                        }))}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Advanced Features - Only show when privilege level is advanced */}
            {bulkSettings.featurePermissions.privilegeLevel === 'advanced' && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3,
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  mb: 3
                }}
              >
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    color: '#e53935',
                    fontWeight: 600,
                    borderBottom: '2px solid #e53935',
                    paddingBottom: 1,
                    marginBottom: 2
                  }}
                >
                  <SecurityIcon sx={{ color: '#e53935' }} />
                  Advanced Features
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid xs={4}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Bulk Actions</Typography>
                      <Switch
                        checked={bulkSettings.featurePermissions.advancedFeatures.canBulkActions}
                        onChange={(e) => setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { 
                            ...prev.featurePermissions, 
                            advancedFeatures: {
                              ...prev.featurePermissions.advancedFeatures,
                              canBulkActions: e.target.checked
                            }
                          }
                        }))}
                      />
                    </Box>
                  </Grid>
                  <Grid xs={4}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Export Data</Typography>
                      <Switch
                        checked={bulkSettings.featurePermissions.advancedFeatures.canExportData}
                        onChange={(e) => setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { 
                            ...prev.featurePermissions, 
                            advancedFeatures: {
                              ...prev.featurePermissions.advancedFeatures,
                              canExportData: e.target.checked
                            }
                          }
                        }))}
                      />
                    </Box>
                  </Grid>
                  <Grid xs={4}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">View Analytics</Typography>
                      <Switch
                        checked={bulkSettings.featurePermissions.advancedFeatures.canViewAnalytics}
                        onChange={(e) => setBulkSettings(prev => ({
                          ...prev,
                          featurePermissions: { 
                            ...prev.featurePermissions, 
                            advancedFeatures: {
                              ...prev.featurePermissions.advancedFeatures,
                              canViewAnalytics: e.target.checked
                            }
                          }
                        }))}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ 
          padding: '20px 24px', 
          backgroundColor: 'white',
          borderTop: '1px solid #e0e0e0',
          gap: 2,
          flexDirection: 'column',
          alignItems: 'stretch'
        }}>
          {(!bulkDialog.applyToAll && bulkDialog.selectedUsers.length === 0) && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Please select at least one user or enable "Apply to all users" to proceed.
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button 
              onClick={() => setBulkDialog({ open: false, selectedUsers: [], applyToAll: false })}
              variant="outlined"
              sx={{ 
                borderColor: '#bdbdbd',
                color: '#757575',
                '&:hover': {
                  borderColor: '#9e9e9e',
                  backgroundColor: '#f5f5f5'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={applyBulkSettings}
              disabled={saving.bulk || (!bulkDialog.applyToAll && bulkDialog.selectedUsers.length === 0)}
              sx={{
                background: 'linear-gradient(135deg, #e53935 0%, #d32f2f 100%)',
                borderRadius: '25px',
                padding: '8px 24px',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                  boxShadow: '0 6px 16px rgba(229, 57, 53, 0.4)',
                },
                '&:disabled': {
                  background: '#bdbdbd',
                  boxShadow: 'none',
                  cursor: 'not-allowed'
                }
              }}
            >
              {saving.bulk ? 'Applying...' : 'Apply Settings'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Grace Period Dialog */}
      <Dialog
        open={graceDialog.open}
        onClose={() => setGraceDialog({ open: false, value: gracePeriodMinutes })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Update Late Grace Period</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            Current grace period: <strong>{gracePeriodMinutes} minutes</strong>. Employees clocking in within this
            window are still considered on time.
          </Typography>
          <TextField
            label="Grace period (minutes)"
            type="number"
            fullWidth
            margin="normal"
            value={graceDialog.value}
            onChange={(e) => setGraceDialog(prev => ({ ...prev, value: e.target.value }))}
            inputProps={{ min: 0, max: 1440 }}
            helperText="Enter a value between 0 and 1440 minutes"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGraceDialog({ open: false, value: gracePeriodMinutes })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleUpdateGracePeriod}
            disabled={updatingGrace}
          >
            {updatingGrace ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ManageSectionPage;