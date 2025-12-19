// frontend/src/components/RecentActivityCard.jsx

import React, { useMemo } from 'react';
import { Typography, Paper, Box } from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot, timelineItemClasses } from '@mui/lab';

// Icons for different activity types
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';

const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const getActivityProps = (type) => {
    switch (type) {
        case 'Clock In':
            return { icon: <LoginIcon fontSize="small" />, color: 'success' };
        case 'Clock Out':
            return { icon: <LogoutIcon fontSize="small" />, color: 'error' };
        case 'Break Started':
            return { icon: <PauseCircleOutlineIcon fontSize="small" />, color: 'warning' };
        case 'Break Ended':
            return { icon: <PlayCircleOutlineIcon fontSize="small" />, color: 'info' };
        default:
            return { icon: <FreeBreakfastIcon fontSize="small" />, color: 'grey' };
    }
};

const RecentActivityCard = ({ dailyData }) => {
    const activities = useMemo(() => {
        if (!dailyData) return [];
        
        const allActivities = [];

        // Process work sessions
        dailyData.sessions?.forEach(session => {
            if (session.startTime) {
                allActivities.push({ type: 'Clock In', timestamp: session.startTime });
            }
            if (session.endTime) {
                allActivities.push({ type: 'Clock Out', timestamp: session.endTime });
            }
        });

        // Process breaks
        dailyData.breaks?.forEach(br => {
            if (br.startTime) {
                allActivities.push({ type: 'Break Started', timestamp: br.startTime, details: `(${br.breakType})` });
            }
            if (br.endTime) {
                allActivities.push({ type: 'Break Ended', timestamp: br.endTime, details: `(${br.breakType})` });
            }
        });

        // Sort all activities by timestamp in descending order and take the latest 5
        return allActivities
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5);

    }, [dailyData]);

    return (
        <Paper elevation={3} sx={{ p: 2.5, borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
            <Typography variant="h6" gutterBottom>Recent Activity</Typography>
            {activities.length > 0 ? (
                <Timeline
                    sx={{
                        [`& .${timelineItemClasses.root}:before`]: {
                            flex: 0,
                            padding: 0,
                        },
                        p: 0,
                        mt: 2
                    }}
                >
                    {activities.map((activity, index) => {
                        const { icon, color } = getActivityProps(activity.type);
                        return (
                            <TimelineItem key={index}>
                                <TimelineSeparator>
                                    <TimelineDot color={color} variant="outlined">
                                        {icon}
                                    </TimelineDot>
                                    {index < activities.length - 1 && <TimelineConnector />}
                                </TimelineSeparator>
                                <TimelineContent sx={{ py: '12px', px: 2 }}>
                                    <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
                                        {activity.type}
                                    </Typography>
                                    {activity.details && (
                                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                            {activity.details}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" display="block" color="text.secondary">
                                        at {formatTime(activity.timestamp) || ''}
                                    </Typography>
                                </TimelineContent>
                            </TimelineItem>
                        );
                    })}
                </Timeline>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 2, mt: 1 }}>
                    No activity recorded for today.
                </Typography>
            )}
        </Paper>
    );
};

export default RecentActivityCard;