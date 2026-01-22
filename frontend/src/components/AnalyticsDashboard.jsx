// frontend/src/components/AnalyticsDashboard.jsx

import React, { useState, useEffect, Fragment } from 'react';
import { Box, Card, CardContent, Typography, Grid, Button, Alert, Chip, Avatar, List, ListItem, ListItemAvatar, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Divider } from '@mui/material';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';
import '../styles/resizable.css';
import {
  TrendingUp,
  TrendingDown,
  AccessTime,
  Warning,
  CheckCircle,
  Cancel,
  People,
  Close,
  Refresh
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import socket from '../socket';

import { SkeletonBox } from '../components/SkeletonLoaders';
const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // State for card sizes with sessionStorage persistence
  const [cardSizes, setCardSizes] = useState(() => {
    const saved = sessionStorage.getItem('analytics-dashboard-card-sizes');
    return saved ? JSON.parse(saved) : {
      overviewCards: { width: 300, height: 350 },
      summaryCard: { width: 1200, height: 280 }
    };
  });

  // Consistent color palette matching app theme
  const COLORS = {
    primary: '#dc3545', // Red
    secondary: '#ffffff', // White
    background: '#f8f9fa', // Light gray background
    navy: '#1a237e', // Navy blue (matching sidebar)
    success: '#dc3545', // Red for on-time (consistent with theme)
    warning: '#dc3545', // Red for late (consistent with theme)
    error: '#dc3545', // Red for half-day/absent (consistent with theme)
    info: '#1a237e', // Navy blue for info
    cardBackground: '#ffffff',
    cardHover: '#f5f5f5',
    textPrimary: '#343a40',
    textSecondary: '#6c757d',
    borderColor: '#dee2e6',
    shadowColor: 'rgba(0, 0, 0, 0.05)'
  };

  useEffect(() => {
    if (user && (user.role === 'Admin' || user.role === 'HR')) {
      fetchOverviewData();
      
      // POLLING REMOVED: Socket events provide real-time updates
      // Listen for attendance_log_updated events instead of polling
      if (socket) {
        const handleAttendanceUpdate = () => {
          console.log('[AnalyticsDashboard] Received attendance_log_updated event, refreshing data');
          fetchOverviewData();
        };

        socket.on('attendance_log_updated', handleAttendanceUpdate);

        // Fallback: Refresh on visibility change if socket disconnected
        const handleVisibilityChange = () => {
          if (!document.hidden && socket.disconnected) {
            console.log('[AnalyticsDashboard] Socket disconnected, refreshing on visibility change');
            fetchOverviewData();
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
          socket.off('attendance_log_updated', handleAttendanceUpdate);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
      }
    }
  }, [user]);

  // Save card sizes to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem('analytics-dashboard-card-sizes', JSON.stringify(cardSizes));
  }, [cardSizes]);

  const handleResize = (cardType, size) => {
    setCardSizes(prev => ({
      ...prev,
      [cardType]: size
    }));
  };

  const fetchOverviewData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('/analytics/overview');
      console.log('Analytics overview response:', response.data);
      setOverviewData(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching overview data:', error);
      setError('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (cardType) => {
    if (!overviewData) return;
    
    const cardData = {
      'late': {
        title: 'Late Employees',
        employees: overviewData.details.lateEmployees,
        color: COLORS.warning,
        icon: <Warning />
      },
      'halfDay': {
        title: 'Half Day Employees',
        employees: overviewData.details.halfDayEmployees,
        color: COLORS.error,
        icon: <Cancel />
      },
      'absent': {
        title: 'Absent Employees',
        employees: overviewData.details.absentEmployees,
        color: COLORS.error,
        icon: <AccessTime />
      },
      'present': {
        title: 'Present Employees',
        employees: overviewData.details.presentEmployees,
        color: COLORS.success,
        icon: <CheckCircle />
      }
    };

    setSelectedCard(cardData[cardType]);
    setSelectedEmployees(cardData[cardType].employees);
    setDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'On-time': return COLORS.primary;
      case 'Late': return COLORS.primary;
      case 'Half-day': return COLORS.primary;
      case 'Absent': return COLORS.textSecondary;
      default: return COLORS.info;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'On-time': return <CheckCircle />;
      case 'Late': return <Warning />;
      case 'Half-day': return <Cancel />;
      case 'Absent': return <AccessTime />;
      default: return <AccessTime />;
    }
  };

  if (!user || (user.role !== 'Admin' && user.role !== 'HR')) {
    return (
      <Box p={3}>
        <Alert severity="warning">Access denied. Admin or HR role required.</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
        <SkeletonBox width="24px" height="24px" borderRadius="50%" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchOverviewData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!overviewData) {
    return (
      <Box p={3}>
        <Alert severity="info">No data available for today.</Alert>
      </Box>
    );
  }

  const cards = [
    {
      title: 'Late Employees',
      count: overviewData.overview.lateEmployees,
      color: COLORS.primary,
      bgColor: COLORS.secondary,
      borderColor: COLORS.primary,
      icon: <Warning />,
      cardType: 'late'
    },
    {
      title: 'Half Day',
      count: overviewData.overview.halfDayEmployees,
      color: COLORS.primary,
      bgColor: COLORS.secondary,
      borderColor: COLORS.primary,
      icon: <Cancel />,
      cardType: 'halfDay'
    },
    {
      title: 'Absent',
      count: overviewData.overview.absentEmployees,
      color: COLORS.textSecondary,
      bgColor: COLORS.secondary,
      borderColor: COLORS.textSecondary,
      icon: <AccessTime />,
      cardType: 'absent'
    },
    {
      title: 'Present',
      count: overviewData.overview.presentEmployees,
      color: COLORS.primary,
      bgColor: COLORS.secondary,
      borderColor: COLORS.primary,
      icon: <CheckCircle />,
      cardType: 'present'
    }
  ];

  return (
    <Box p={3} sx={{ backgroundColor: COLORS.background, minHeight: '100vh' }}>

      {/* Date Display */}
      <Card sx={{ 
        backgroundColor: COLORS.cardBackground,
        mb: 4,
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        border: `1px solid ${COLORS.borderColor}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
        }
      }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ 
            color: COLORS.navy, 
            fontWeight: 'bold',
            textAlign: 'center',
            mb: 1
          }}>
            📅 {new Date(overviewData.date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Typography>
          <Typography variant="body2" sx={{ 
            color: COLORS.textSecondary,
            textAlign: 'center'
          }}>
            Real-time attendance analytics for today
          </Typography>
          {lastUpdated && (
            <Typography variant="caption" sx={{ 
              color: COLORS.textSecondary,
              textAlign: 'center',
              display: 'block',
              mt: 1
            }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}
        </CardContent>
      </Card>

          {/* Overview Cards */}
          <Grid container spacing={3} mb={6} justifyContent="center">
            {cards.map((card, index) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={index} sx={{ display: 'flex', justifyContent: 'center' }}>
                <ResizableBox
                  width={cardSizes.overviewCards.width}
                  height={cardSizes.overviewCards.height}
                  minConstraints={[200, 200]}
                  maxConstraints={[600, 600]}
                  resizeHandles={['se']}
                  onResize={(e, { size }) => handleResize('overviewCards', size)}
                  style={{
                    margin: '0 auto',
                    position: 'relative'
                  }}
                >
                  <Card
                    className="resizable-card"
                    sx={{
                      backgroundColor: card.bgColor,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                        backgroundColor: COLORS.cardHover
                      },
                      border: `2px solid ${card.borderColor}`,
                      borderRadius: '16px',
                      overflow: 'hidden',
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    onClick={() => handleCardClick(card.cardType)}
                  >
                  <CardContent sx={{ 
                    textAlign: 'center', 
                    p: { xs: 3, sm: 4, md: 5 },
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <Box
                      sx={{
                        width: { xs: 70, sm: 80, md: 90 },
                        height: { xs: 70, sm: 80, md: 90 },
                        borderRadius: '50%',
                        backgroundColor: card.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        color: 'white',
                        boxShadow: `0 6px 24px ${card.color}40`
                      }}
                    >
                      {card.icon}
                    </Box>
                    <Typography variant="h2" sx={{
                      color: card.color,
                      fontWeight: 'bold',
                      mb: 2,
                      fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' }
                    }}>
                      {card.count}
                    </Typography>
                    <Typography variant="h6" sx={{
                      color: COLORS.textPrimary,
                      fontWeight: 'bold',
                      mb: 1,
                      fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.4rem' }
                    }}>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" sx={{
                      color: COLORS.textSecondary,
                      fontWeight: '500',
                      fontSize: { xs: '0.9rem', sm: '1rem' }
                    }}>
                      Click to view details
                    </Typography>
                  </CardContent>
                </Card>
                </ResizableBox>
              </Grid>
            ))}
          </Grid>

      {/* Summary Stats */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <ResizableBox
          width={cardSizes.summaryCard.width}
          height={cardSizes.summaryCard.height}
          minConstraints={[400, 200]}
          maxConstraints={[1400, 500]}
          resizeHandles={['se']}
          onResize={(e, { size }) => handleResize('summaryCard', size)}
          style={{
            margin: '0 auto',
            position: 'relative'
          }}
        >
          <Card 
            className="resizable-card"
            sx={{ 
              backgroundColor: COLORS.cardBackground, 
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              border: `1px solid ${COLORS.borderColor}`,
              width: '100%',
              height: '100%',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
              }
            }}>
        <CardContent sx={{ p: { xs: 4, sm: 5, md: 6 } }}>
          <Typography variant="h5" sx={{ 
            color: COLORS.navy, 
            mb: 4, 
            fontWeight: 'bold',
            textAlign: 'center',
            fontSize: { xs: '1.4rem', sm: '1.6rem', md: '1.8rem' }
          }}>
            📊 Summary Statistics
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: { xs: 2, sm: 3, md: 4 }
          }}>
            <Box sx={{ 
              textAlign: 'center', 
              p: { xs: 2, sm: 3, md: 4 },
              minWidth: { xs: '150px', sm: '180px', md: '200px' }
            }}>
              <Typography variant="h3" sx={{ 
                color: COLORS.navy, 
                fontWeight: 'bold', 
                mb: 2,
                fontSize: { xs: '2.2rem', sm: '2.5rem', md: '2.8rem' }
              }}>
                {overviewData.overview.totalEmployees}
              </Typography>
              <Typography variant="body1" sx={{ 
                color: COLORS.textSecondary, 
                fontWeight: '500',
                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.2rem' }
              }}>
                Total Employees
              </Typography>
            </Box>
            <Box sx={{ 
              textAlign: 'center', 
              p: { xs: 2, sm: 3, md: 4 },
              minWidth: { xs: '150px', sm: '180px', md: '200px' }
            }}>
              <Typography variant="h3" sx={{ 
                color: COLORS.primary, 
                fontWeight: 'bold', 
                mb: 2,
                fontSize: { xs: '2.2rem', sm: '2.5rem', md: '2.8rem' }
              }}>
                {((overviewData.overview.presentEmployees / overviewData.overview.totalEmployees) * 100).toFixed(1)}%
              </Typography>
              <Typography variant="body1" sx={{ 
                color: COLORS.textSecondary, 
                fontWeight: '500',
                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.2rem' }
              }}>
                Attendance Rate
              </Typography>
            </Box>
            <Box sx={{ 
              textAlign: 'center', 
              p: { xs: 2, sm: 3, md: 4 },
              minWidth: { xs: '150px', sm: '180px', md: '200px' }
            }}>
              <Typography variant="h3" sx={{ 
                color: COLORS.primary, 
                fontWeight: 'bold', 
                mb: 2,
                fontSize: { xs: '2.2rem', sm: '2.5rem', md: '2.8rem' }
              }}>
                {overviewData.overview.lateEmployees + overviewData.overview.halfDayEmployees}
              </Typography>
              <Typography variant="body1" sx={{ 
                color: COLORS.textSecondary, 
                fontWeight: '500',
                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.2rem' }
              }}>
                Late/Half Day
              </Typography>
            </Box>
            <Box sx={{ 
              textAlign: 'center', 
              p: { xs: 2, sm: 3, md: 4 },
              minWidth: { xs: '150px', sm: '180px', md: '200px' }
            }}>
              <Typography variant="h3" sx={{ 
                color: COLORS.textSecondary, 
                fontWeight: 'bold', 
                mb: 2,
                fontSize: { xs: '2.2rem', sm: '2.5rem', md: '2.8rem' }
              }}>
                {overviewData.overview.absentEmployees}
              </Typography>
              <Typography variant="body1" sx={{ 
                color: COLORS.textSecondary, 
                fontWeight: '500',
                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.2rem' }
              }}>
                Absent Today
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
        </ResizableBox>
      </Box>

      {/* Employee Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { 
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: COLORS.navy, 
          color: COLORS.secondary,
          p: 3
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {selectedCard?.title}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Click on any employee to view detailed analytics
              </Typography>
            </Box>
            <IconButton 
              onClick={() => setDialogOpen(false)} 
              sx={{ 
                color: COLORS.secondary,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: COLORS.background }}>
          {selectedEmployees.length === 0 ? (
            <Box p={4} textAlign="center">
              <Typography variant="h6" sx={{ color: COLORS.textSecondary }}>
                No employees found
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {selectedEmployees.map((employee, index) => (
                <Fragment key={employee.id}>
                  <ListItem sx={{ 
                    p: 3,
                    '&:hover': {
                      backgroundColor: COLORS.cardHover
                    },
                    transition: 'background-color 0.2s ease'
                  }}>
                    <ListItemAvatar>
                      <Avatar sx={{ 
                        backgroundColor: getStatusColor(employee.status),
                        width: 48,
                        height: 48,
                        boxShadow: `0 4px 12px ${getStatusColor(employee.status)}40`
                      }}>
                        {getStatusIcon(employee.status)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={2} mb={1}>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 'bold',
                            color: COLORS.textPrimary
                          }}>
                            {employee.name}
                          </Typography>
                          <Chip
                            label={employee.status}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(employee.status),
                              color: 'white',
                              fontWeight: 'bold',
                              borderRadius: '20px'
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ 
                            color: COLORS.textSecondary,
                            mb: 0.5
                          }}>
                            {employee.email} • {employee.department || 'No Department'}
                          </Typography>
                          {employee.loginTime && (
                            <Typography variant="body2" sx={{ 
                              color: COLORS.textSecondary,
                              fontWeight: '500'
                            }}>
                              Login: {new Date(employee.loginTime).toLocaleTimeString('en-US', { 
                                timeZone: 'Asia/Kolkata', 
                                hour12: true 
                              })}
                              {employee.lateMinutes > 0 && (
                                <span style={{ 
                                  color: COLORS.warning, 
                                  fontWeight: 'bold',
                                  marginLeft: '8px'
                                }}>
                                  ({(() => {
                                    const hours = Math.floor(employee.lateMinutes / 60);
                                    const mins = employee.lateMinutes % 60;
                                    if (hours > 0 && mins > 0) return `${hours}h ${mins}m late`;
                                    if (hours > 0) return `${hours}h late`;
                                    return `${mins}m late`;
                                  })()})
                                </span>
                              )}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < selectedEmployees.length - 1 && (
                    <Divider sx={{ mx: 3 }} />
                  )}
                </Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          backgroundColor: COLORS.cardBackground,
          borderTop: `1px solid ${COLORS.borderColor}`
        }}>
          <Button 
            onClick={() => setDialogOpen(false)} 
            variant="outlined"
            sx={{
              borderColor: COLORS.borderColor,
              color: COLORS.textPrimary,
              borderRadius: '12px',
              px: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: COLORS.cardHover,
                borderColor: COLORS.primary
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnalyticsDashboard;
