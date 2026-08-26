// src/components/CommentsPanel.jsx
// Append-only run-level comments drawer
// - MUI Drawer, anchor="right", width 360px
// - Scrollable comment list showing authorEmail, text, formatted createdAt
// - TextField multiline + "Add Note" button at bottom
// - Empty state: "No notes yet"
// - No edit/delete — append-only
import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  Alert,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import api from '../api/axios';

export default function CommentsPanel({ open, onClose, run, onReload }) {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    
    if (commentText.length > 2000) {
      setError('Comment must be 2000 characters or less.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await api.post(`/payroll-runs/${run._id}/comments`, { text: commentText.trim() });
      setCommentText('');
      // Reload the run data to get updated comments
      if (onReload) onReload();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to add comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const comments = run?.comments || [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 360,
          maxWidth: '100%',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--ink)' }}>
          Notes
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'var(--ink-secondary)' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Comments list */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {comments.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              color: 'var(--ink-muted)',
            }}
          >
            <Typography variant="body2">No notes yet</Typography>
          </Box>
        ) : (
          comments.map((comment, idx) => (
            <Box key={idx}>
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--ink-secondary)',
                  fontWeight: 500,
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {comment.authorEmail}
                {' · '}
                {new Date(comment.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                {comment.text}
              </Typography>
              {idx < comments.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))
        )}
      </Box>

      {/* Add comment form */}
      <Box
        sx={{
          borderTop: '1px solid var(--border)',
          p: 2,
          bgcolor: 'var(--paper)',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8125rem' }}>
            {error}
          </Alert>
        )}
        <TextField
          multiline
          rows={3}
          fullWidth
          placeholder="Add a note..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          disabled={submitting}
          sx={{ mb: 1.5 }}
        />
        <Button
          variant="contained"
          fullWidth
          disabled={!commentText.trim() || submitting}
          onClick={handleAddComment}
          sx={{ fontWeight: 600 }}
        >
          {submitting ? 'Adding...' : 'Add Note'}
        </Button>
      </Box>
    </Drawer>
  );
}
