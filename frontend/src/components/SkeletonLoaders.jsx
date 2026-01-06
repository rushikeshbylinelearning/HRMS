// frontend/src/components/SkeletonLoaders.jsx
// Reusable skeleton loader components for better perceived performance

import React from 'react';
import { Box, Skeleton, Stack } from '@mui/material';

/**
 * Shimmer animation keyframes
 */
const shimmerAnimation = {
    '@keyframes shimmer': {
        '0%': {
            backgroundPosition: '-1000px 0'
        },
        '100%': {
            backgroundPosition: '1000px 0'
        }
    }
};

const shimmerStyles = {
    background: 'linear-gradient(to right, #f0f0f0 8%, #e0e0e0 18%, #f0f0f0 33%)',
    backgroundSize: '1000px 100%',
    animation: 'shimmer 1.5s infinite linear',
    ...shimmerAnimation
};

/**
 * Table Skeleton Loader
 * Matches typical table structure
 */
export const TableSkeleton = ({ rows = 5, columns = 4, minHeight }) => {
    return (
        <Box sx={{ width: '100%', minHeight: minHeight || '400px' }}>
            {/* Table Header */}
            <Stack direction="row" spacing={2} sx={{ mb: 2, px: 2 }}>
                {Array.from({ length: columns }).map((_, idx) => (
                    <Skeleton
                        key={`header-${idx}`}
                        variant="rectangular"
                        width="100%"
                        height={40}
                        sx={shimmerStyles}
                    />
                ))}
            </Stack>
            
            {/* Table Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <Stack
                    key={`row-${rowIdx}`}
                    direction="row"
                    spacing={2}
                    sx={{ mb: 1.5, px: 2 }}
                >
                    {Array.from({ length: columns }).map((_, colIdx) => (
                        <Skeleton
                            key={`cell-${rowIdx}-${colIdx}`}
                            variant="rectangular"
                            width="100%"
                            height={56}
                            sx={shimmerStyles}
                        />
                    ))}
                </Stack>
            ))}
        </Box>
    );
};

/**
 * Card Skeleton Loader
 * Matches typical card layout
 */
export const CardSkeleton = ({ count = 1, minHeight }) => {
    return (
        <Stack spacing={2} sx={{ width: '100%', minHeight: minHeight || '200px' }}>
            {Array.from({ length: count }).map((_, idx) => (
                <Box key={`card-${idx}`} sx={{ p: 2 }}>
                    {/* Card Title */}
                    <Skeleton
                        variant="text"
                        width="60%"
                        height={32}
                        sx={{ mb: 2, ...shimmerStyles }}
                    />
                    
                    {/* Card Content */}
                    <Stack spacing={1}>
                        <Skeleton
                            variant="text"
                            width="100%"
                            height={24}
                            sx={shimmerStyles}
                        />
                        <Skeleton
                            variant="text"
                            width="80%"
                            height={24}
                            sx={shimmerStyles}
                        />
                        <Skeleton
                            variant="rectangular"
                            width="100%"
                            height={120}
                            sx={{ borderRadius: 1, ...shimmerStyles }}
                        />
                    </Stack>
                </Box>
            ))}
        </Stack>
    );
};

/**
 * Form Skeleton Loader
 * Matches typical form structure
 */
export const FormSkeleton = ({ fields = 5, minHeight }) => {
    return (
        <Box sx={{ width: '100%', minHeight: minHeight || '400px', p: 3 }}>
            <Stack spacing={3}>
                {/* Form Title */}
                <Skeleton
                    variant="text"
                    width="40%"
                    height={40}
                    sx={shimmerStyles}
                />
                
                {/* Form Fields */}
                {Array.from({ length: fields }).map((_, idx) => (
                    <Box key={`field-${idx}`}>
                        <Skeleton
                            variant="text"
                            width="30%"
                            height={20}
                            sx={{ mb: 1, ...shimmerStyles }}
                        />
                        <Skeleton
                            variant="rectangular"
                            width="100%"
                            height={56}
                            sx={{ borderRadius: 1, ...shimmerStyles }}
                        />
                    </Box>
                ))}
                
                {/* Submit Button */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Skeleton
                        variant="rectangular"
                        width={120}
                        height={40}
                        sx={{ borderRadius: 1, ...shimmerStyles }}
                    />
                </Box>
            </Stack>
        </Box>
    );
};

/**
 * Dashboard Skeleton Loader
 * Matches typical dashboard layout with cards and stats
 */
export const DashboardSkeleton = ({ minHeight }) => {
    return (
        <Box sx={{ width: '100%', minHeight: minHeight || '600px', p: 3 }}>
            {/* Dashboard Header */}
            <Skeleton
                variant="text"
                width="40%"
                height={48}
                sx={{ mb: 4, ...shimmerStyles }}
            />
            
            {/* Stats Cards Row */}
            <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                {Array.from({ length: 4 }).map((_, idx) => (
                    <Box
                        key={`stat-${idx}`}
                        sx={{
                            flex: 1,
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid #e0e0e0',
                        }}
                    >
                        <Skeleton
                            variant="text"
                            width="60%"
                            height={20}
                            sx={{ mb: 1, ...shimmerStyles }}
                        />
                        <Skeleton
                            variant="text"
                            width="80%"
                            height={40}
                            sx={shimmerStyles}
                        />
                    </Box>
                ))}
            </Stack>
            
            {/* Content Cards */}
            <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 2 }}>
                    <CardSkeleton count={2} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <CardSkeleton count={1} />
                </Box>
            </Stack>
        </Box>
    );
};

/**
 * List Skeleton Loader
 * For simple list items
 */
export const ListSkeleton = ({ items = 5, minHeight }) => {
    return (
        <Stack spacing={1.5} sx={{ width: '100%', minHeight: minHeight || '300px', p: 2 }}>
            {Array.from({ length: items }).map((_, idx) => (
                <Box
                    key={`list-item-${idx}`}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                    }}
                >
                    <Skeleton
                        variant="circular"
                        width={40}
                        height={40}
                        sx={shimmerStyles}
                    />
                    <Box sx={{ flex: 1 }}>
                        <Skeleton
                            variant="text"
                            width="70%"
                            height={24}
                            sx={{ mb: 0.5, ...shimmerStyles }}
                        />
                        <Skeleton
                            variant="text"
                            width="50%"
                            height={20}
                            sx={shimmerStyles}
                        />
                    </Box>
                </Box>
            ))}
        </Stack>
    );
};

/**
 * Generic Page Skeleton
 * Full page skeleton that maintains layout structure
 */
export const PageSkeleton = ({ type = 'default', minHeight }) => {
    switch (type) {
        case 'table':
            return <TableSkeleton minHeight={minHeight} />;
        case 'dashboard':
            return <DashboardSkeleton minHeight={minHeight} />;
        case 'form':
            return <FormSkeleton minHeight={minHeight} />;
        case 'list':
            return <ListSkeleton minHeight={minHeight} />;
        default:
            return <CardSkeleton count={3} minHeight={minHeight} />;
    }
};

export default {
    TableSkeleton,
    CardSkeleton,
    FormSkeleton,
    DashboardSkeleton,
    ListSkeleton,
    PageSkeleton,
};




























