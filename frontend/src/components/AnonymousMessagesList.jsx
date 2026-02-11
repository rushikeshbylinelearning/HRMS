import React from 'react';
import {
    Box,
    Typography,
    Paper,
    Stack,
    Divider
} from '@mui/material';
import MessageIcon from '@mui/icons-material/Message';

const AnonymousMessagesList = ({ messages, loading }) => {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                Loading messages...
            </Typography>
        );
    }

    if (messages.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 6 }}>
                <MessageIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                    No anonymous messages yet
                </Typography>
            </Box>
        );
    }

    return (
        <Stack spacing={2}>
            {messages.map((msg, index) => (
                <Paper
                    key={msg._id || index}
                    elevation={0}
                    sx={{
                        p: 2.5,
                        border: '1px solid #e8e8e8',
                        borderRadius: '12px',
                        backgroundColor: '#fafafa',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            backgroundColor: '#f5f5f5',
                            borderColor: '#d0d0d0'
                        }
                    }}
                >
                    <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <MessageIcon sx={{ fontSize: 18, color: '#666' }} />
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Anonymous Employee
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                                {formatDate(msg.submittedAt)}
                            </Typography>
                        </Box>
                        
                        <Divider />
                        
                        <Typography
                            variant="body2"
                            sx={{
                                color: '#333',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}
                        >
                            {msg.message}
                        </Typography>
                    </Stack>
                </Paper>
            ))}
        </Stack>
    );
};

export default AnonymousMessagesList;
