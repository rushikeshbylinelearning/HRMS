// frontend/src/components/SaturdaySchedule.jsx
import React, { useMemo } from 'react';
import { Typography, Box, Stack, Avatar } from '@mui/material';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import { green, blue, grey } from '@mui/material/colors';

const getNthDayOfMonth = (date, dayOfWeek, n) => { /* ... unchanged ... */
    const newDate = new Date(date.getTime());
    newDate.setDate(1);
    const firstDay = newDate.getDay();
    let day = dayOfWeek - firstDay + 1;
    if (day <= 0) day += 7;
    const nthDate = day + (n - 1) * 7;
    if (nthDate > new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate()) return null;
    newDate.setDate(nthDate);
    return newDate;
};
const getStatusProps = (status) => { /* ... unchanged ... */
    if (status.includes('Approved')) return { text: 'On Leave', Icon: BeachAccessIcon, avatarBg: blue[100], iconColor: blue[800] };
    switch (status) {
        case 'Working': return { text: 'Working Day', Icon: WorkHistoryIcon, avatarBg: green[100], iconColor: green[800] };
        default: return { text: 'Holiday', Icon: EventBusyIcon, avatarBg: grey[200], iconColor: grey[800] };
    }
};

const SaturdaySchedule = ({ policy, requests = [], count = 4 }) => {
    const schedule = useMemo(() => { /* ... logic unchanged ... */
        const approvedRequestsMap = new Map();
        if (requests) { 
            requests.forEach(req => { 
                if (req.status === 'Approved' && req.leaveDates) { 
                    // Fix: Use the date directly if it's already in YYYY-MM-DD format
                    // to avoid timezone conversion issues
                    const dateKey = typeof req.leaveDates[0] === 'string' && req.leaveDates[0].includes('-') 
                        ? req.leaveDates[0] 
                        : new Date(req.leaveDates[0]).toISOString().split('T')[0]; 
                    approvedRequestsMap.set(dateKey, req); 
                } 
            }); 
        }
        const upcomingSaturdays = []; const today = new Date(); today.setHours(0, 0, 0, 0); let monthOffset = 0;
        while (upcomingSaturdays.length < count) {
            const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
            for (let n = 1; n <= 5; n++) {
                const sat = getNthDayOfMonth(targetDate, 6, n);
                if (sat && sat >= today && upcomingSaturdays.length < count) {
                    const dateString = sat.toISOString().split('T')[0]; const weekNum = n; let finalStatus; const approvedRequest = approvedRequestsMap.get(dateString);
                    if (approvedRequest) { finalStatus = `${approvedRequest.requestType} Approved`; } else { let isWorkingDay = true; if (policy === 'All Saturdays Off') { isWorkingDay = false; } else if (policy === 'Week 1 & 3 Off' && (weekNum === 1 || weekNum === 3)) { isWorkingDay = false; } else if (policy === 'Week 2 & 4 Off' && (weekNum === 2 || weekNum === 4)) { isWorkingDay = false; } finalStatus = isWorkingDay ? 'Working' : 'Off'; }
                    upcomingSaturdays.push({ date: sat, status: finalStatus });
                }
            }
            monthOffset++; if (monthOffset > 12) break;
        }
        return upcomingSaturdays;
    }, [policy, requests, count]);

    return (
        <Stack spacing={2.5}>
            {schedule.map(({ date, status }) => {
                const { text, Icon, avatarBg, iconColor } = getStatusProps(status);
                return (
                    <Box key={date.toISOString()} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: avatarBg, color: iconColor }}><Icon fontSize="small" /></Avatar>
                        <Box>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>{date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</Typography>
                            <Typography variant="body2" color="text.secondary">{text}</Typography>
                        </Box>
                    </Box>
                );
            })}
        </Stack>
    );
};
export default SaturdaySchedule;