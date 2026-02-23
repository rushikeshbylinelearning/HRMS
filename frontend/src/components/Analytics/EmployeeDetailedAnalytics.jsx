/**
 * EMPLOYEE DETAILED ANALYTICS COMPONENT
 * 
 * Displays comprehensive attendance analytics for a single employee.
 * Includes KPI cards, filters, and detailed daily attendance log table.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FilterListIcon from '@mui/icons-material/FilterList';
import { fetchEmployeeDetailedAnalytics } from '../../services/employeeAnalyticsService';
import { getISTNow } from '../../utils/istTime';
import PageHeroHeader from '../PageHeroHeader';
import EmployeeKPICards from './EmployeeKPICards';
import EmployeeFilterControls from './EmployeeFilterControls';
import DailyAttendanceLogTable from './DailyAttendanceLogTable';
import './EmployeeDetailedAnalytics.css';

function EmployeeDetailedAnalytics() {
    const { employeeId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const debounceRef = useRef(null);
    
    // Initialize filters from URL params or current month
    const [filters, setFilters] = useState(() => {
        const now = getISTNow();
        const urlMonth = searchParams.get('month');
        const urlYear = searchParams.get('year');
        
        return {
            month: urlMonth ? parseInt(urlMonth) : now.getMonth() + 1,
            year: urlYear ? parseInt(urlYear) : now.getFullYear()
        };
    });
    
    // Fetch employee analytics data
    const fetchData = async () => {
        try {
            // First load: show full spinner. Subsequent loads: show subtle refreshing indicator.
            if (data === null) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }
            setError(null);
            const result = await fetchEmployeeDetailedAnalytics(
                employeeId,
                filters.month,
                filters.year
            );
            setData(result);
        } catch (err) {
            console.error('Error fetching employee analytics:', err);
            setError(err.message || 'Failed to fetch employee analytics');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    
    // Fetch data when filters change (debounced)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchData();
        }, 400);
        return () => clearTimeout(debounceRef.current);
    }, [employeeId, filters]);
    
    // Handle filter changes
    const handleFilterChange = (newFilters) => {
        setFilters(prev => ({
            ...prev,
            ...newFilters
        }));
    };
    
    // Handle back navigation
    const handleBack = () => {
        navigate('/analytics/attendance');
    };
    
    // Handle toggle filters
    const handleToggleFilters = () => {
        setShowFilters(prev => !prev);
    };
    
    // Get month name
    const getMonthName = (month) => {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[month - 1] || '';
    };
    
    return (
        <Box className="employee-detailed-analytics">
            <PageHeroHeader
                eyebrow="Employee Analytics"
                title={
                    <Box>
                        <Box sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2 }}>
                            {data?.employeeInfo?.fullName || 'Loading...'}
                        </Box>
                        {data && (
                            <Box sx={{ 
                                fontSize: '0.875rem', 
                                opacity: 0.9, 
                                mt: 0.5,
                                fontWeight: 400
                            }}>
                                {data.employeeInfo.employeeCode} • {data.employeeInfo.department} • {getMonthName(filters.month)} {filters.year}
                            </Box>
                        )}
                    </Box>
                }
                description={null}
                actionArea={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <IconButton
                            onClick={handleBack}
                            size="small"
                            sx={{
                                color: 'white',
                                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                },
                                width: 36,
                                height: 36
                            }}
                        >
                            <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <Button
                            variant="contained"
                            startIcon={<FilterListIcon />}
                            onClick={handleToggleFilters}
                            size="medium"
                            sx={{
                                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                                color: 'white',
                                textTransform: 'none',
                                fontWeight: 600,
                                px: 2.5,
                                py: 0.75,
                                borderRadius: '8px',
                                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                                fontSize: '0.875rem',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.5)',
                                }
                            }}
                        >
                            Filter
                        </Button>
                    </Box>
                }
            />
            
            <Box sx={{ py: 0, px: 3, maxWidth: '100%' }}>
                {showFilters && (
                    <EmployeeFilterControls
                        filters={filters}
                        onFilterChange={handleFilterChange}
                    />
                )}
                
                {/* Only show full-page spinner when there's no data yet */}
                {loading && (
                    <Box className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading employee analytics...</p>
                    </Box>
                )}
                
                {/* Show subtle indicator when refreshing existing data */}
                {refreshing && data && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0, pb: 1, opacity: 0.6 }}>
                        <div className="spinner" style={{ width: 16, height: 16 }} />
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Updating...</span>
                    </Box>
                )}
                
                {error && (
                    <Box className="error-state">
                        <div className="error-icon">⚠️</div>
                        <h3>Error Loading Data</h3>
                        <p>{error}</p>
                        <Button
                            variant="contained"
                            onClick={fetchData}
                            sx={{
                                background: '#3b82f6',
                                textTransform: 'none',
                                '&:hover': {
                                    background: '#2563eb',
                                }
                            }}
                        >
                            Try Again
                        </Button>
                    </Box>
                )}
                
                {/* Always show data if we have it, even during refresh */}
                {!loading && !error && data && (
                    <>
                        <EmployeeKPICards summary={data.summary} />
                        <DailyAttendanceLogTable dailyLogs={data.dailyLogs} />
                    </>
                )}
            </Box>
        </Box>
    );
}

export default EmployeeDetailedAnalytics;
