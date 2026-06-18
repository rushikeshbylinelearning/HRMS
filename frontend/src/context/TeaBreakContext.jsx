import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import socket from '../socket';
import { useAuth } from './AuthContext';
import useDesktopNotification from '../hooks/useDesktopNotification';

const TeaBreakContext = createContext({
  teaBreakData: null,
  clearTeaBreak: () => {},
});

function teaBreakEndedStorageKey(announcementId) {
  return `tea_break_ended_${announcementId}`;
}

function hasLocallyEndedTeaBreak(announcementId) {
  if (!announcementId) return false;
  return localStorage.getItem(teaBreakEndedStorageKey(announcementId)) === '1';
}

export function TeaBreakProvider({ children }) {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { requestPermission, showNotification } = useDesktopNotification();
  const [teaBreakData, setTeaBreakData] = useState(null);

  const clearTeaBreak = useCallback(() => {
    setTeaBreakData((prev) => {
      if (prev?.announcementId) {
        localStorage.setItem(teaBreakEndedStorageKey(prev.announcementId), '1');
      }
      return null;
    });
  }, []);

  const dismissTeaBreak = useCallback((announcementId) => {
    if (announcementId) {
      localStorage.setItem(teaBreakEndedStorageKey(announcementId), '1');
    }
    setTeaBreakData(null);
  }, []);

  const applyTeaBreakPayload = useCallback((data) => {
    if (!data?.announcementId || !data?.teaBreakStartedAt) return;
    if (hasLocallyEndedTeaBreak(data.announcementId)) return;
    setTeaBreakData({
      announcementId: data.announcementId,
      startedAt: data.teaBreakStartedAt,
      durationMinutes: data.durationMinutes ?? 10,
      type: data.teaBreakType,
    });
  }, []);

  useEffect(() => {
    if (!token || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      requestPermission();
    }
  }, [token, requestPermission]);

  useEffect(() => {
    if (!token) return;

    const fetchActive = async () => {
      try {
        const { data } = await api.get('/tea-break/active');
        if (data?.active) {
          applyTeaBreakPayload(data);
        }
      } catch (err) {
        console.error('[TeaBreak] Failed to fetch active tea break:', err);
      }
    };

    fetchActive();
  }, [token, applyTeaBreakPayload]);

  useEffect(() => {
    if (!token) return;

    if (!socket.connected) {
      socket.auth = { token };
      socket.connect();
    }

    const handleTeaBreakStarted = (data) => {
      applyTeaBreakPayload(data);

      const label = data.teaBreakType === 'evening' ? 'Evening' : 'Morning';
      showNotification('☕ Tea Break Started!', {
        body: `${label} tea break — 10 minutes starting now.`,
        icon: '/AMS.webp',
        tag: 'tea-break',
        onClick: () => {
          const dashboardPath = user?.role === 'Admin' || user?.role === 'HR'
            ? '/admin/dashboard'
            : '/dashboard';
          navigate(dashboardPath);
        },
      });
    };

    const handleTeaBreakStopped = (data) => {
      if (data?.announcementId) {
        dismissTeaBreak(data.announcementId);
      } else {
        setTeaBreakData(null);
      }
    };

    socket.on('tea_break_started', handleTeaBreakStarted);
    socket.on('tea_break_stopped', handleTeaBreakStopped);
    return () => {
      socket.off('tea_break_started', handleTeaBreakStarted);
      socket.off('tea_break_stopped', handleTeaBreakStopped);
    };
  }, [token, applyTeaBreakPayload, dismissTeaBreak, showNotification, navigate, user?.role]);

  const value = useMemo(
    () => ({ teaBreakData, clearTeaBreak, setTeaBreakData, dismissTeaBreak }),
    [teaBreakData, clearTeaBreak, dismissTeaBreak]
  );

  return (
    <TeaBreakContext.Provider value={value}>
      {children}
    </TeaBreakContext.Provider>
  );
}

export function useTeaBreak() {
  return useContext(TeaBreakContext);
}

export default TeaBreakContext;
