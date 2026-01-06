// frontend/src/components/DashboardSkeletons.jsx
import React from 'react';
import { Box, Skeleton, Stack, Paper } from '@mui/material';

export const ShiftInfoSkeleton = () => (
    <Stack spacing={2}>
        <Box>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
        </Box>
        <Box>
            <Skeleton variant="text" width="70%" height={24} />
            <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
        </Box>
        <Box>
            <Skeleton variant="text" width="65%" height={24} />
            <Skeleton variant="text" width="45%" height={20} sx={{ mt: 1 }} />
        </Box>
    </Stack>
);

export const RecentActivitySkeleton = () => (
    <Stack spacing={2}>
        {[1, 2, 3, 4].map((i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="80%" height={20} />
                    <Skeleton variant="text" width="60%" height={16} sx={{ mt: 0.5 }} />
                </Box>
                <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
            </Box>
        ))}
    </Stack>
);

export const SaturdayScheduleSkeleton = () => (
    <Stack spacing={2}>
        {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton variant="text" width="40%" height={20} />
                <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
            </Box>
        ))}
    </Stack>
);

export const WeeklyTimeCardsSkeleton = () => (
    <Stack spacing={2}>
        <Skeleton variant="rectangular" width="100%" height={80} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={80} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={80} sx={{ borderRadius: 2 }} />
    </Stack>
);









