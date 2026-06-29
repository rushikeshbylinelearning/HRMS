import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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



function teaBreakNotifiedStorageKey(announcementId) {

  return `tea_break_notified_${announcementId}`;

}



function hasLocallyEndedTeaBreak(announcementId) {

  if (!announcementId) return false;

  return localStorage.getItem(teaBreakEndedStorageKey(announcementId)) === '1';

}



function wasTeaBreakNotified(announcementId) {

  if (!announcementId) return false;

  return sessionStorage.getItem(teaBreakNotifiedStorageKey(announcementId)) === '1';

}



function markTeaBreakNotified(announcementId) {

  if (!announcementId) return;

  sessionStorage.setItem(teaBreakNotifiedStorageKey(announcementId), '1');

}



function normalizeAnnouncementId(id) {

  if (!id) return null;

  if (typeof id === 'string') return id;

  if (typeof id === 'object' && id.$oid) return id.$oid;

  return String(id);

}



export function TeaBreakProvider({ children }) {

  const { token, user, authStatus } = useAuth();

  const navigate = useNavigate();

  const { requestPermission, showNotification } = useDesktopNotification();

  const [teaBreakData, setTeaBreakData] = useState(null);

  const userRoleRef = useRef(user?.role);

  userRoleRef.current = user?.role;



  const clearTeaBreak = useCallback(() => {

    setTeaBreakData((prev) => {

      if (prev?.announcementId) {

        localStorage.setItem(teaBreakEndedStorageKey(prev.announcementId), '1');

      }

      return null;

    });

  }, []);



  const dismissTeaBreak = useCallback((announcementId) => {

    const id = normalizeAnnouncementId(announcementId);

    if (id) {

      localStorage.setItem(teaBreakEndedStorageKey(id), '1');

    }

    setTeaBreakData(null);

  }, []);



  const applyActiveTeaBreak = useCallback((data) => {

    if (!data?.active) {

      setTeaBreakData(null);

      return;

    }



    const announcementId = normalizeAnnouncementId(data.announcementId);

    if (!announcementId || !data?.teaBreakStartedAt) {

      setTeaBreakData(null);

      return;

    }

    if (hasLocallyEndedTeaBreak(announcementId)) {

      setTeaBreakData(null);

      return;

    }



    setTeaBreakData({

      announcementId,

      startedAt: data.teaBreakStartedAt,

      endsAt: data.endsAt || null,

      remainingSeconds: data.remainingSeconds,

      serverNow: data.serverNow || null,

      durationMinutes: data.durationMinutes ?? 10,

      type: data.teaBreakType,

    });

  }, []);



  const showTeaBreakDesktopNotification = useCallback((data, { force = false } = {}) => {

    const announcementId = normalizeAnnouncementId(data?.announcementId);

    if (!announcementId) return;



    const currentUserId = user?._id || user?.id;

    const initiatorId = data?.initiatedByUserId;

    if (initiatorId && currentUserId && String(initiatorId) === String(currentUserId)) {

      return;

    }



    if (!force && wasTeaBreakNotified(announcementId)) return;



    const label = data.teaBreakType === 'evening' ? 'Evening' : 'Morning';

    const notification = showNotification('☕ Tea Break Started!', {

      body: `${label} tea break — 10 minutes starting now.`,

      icon: '/AMS.webp',

      tag: `tea-break-${announcementId}`,

      onClick: () => {

        const role = userRoleRef.current;

        const dashboardPath = role === 'Admin' || role === 'HR'

          ? '/admin/dashboard'

          : '/dashboard';

        navigate(dashboardPath);

      },

    });



    if (notification) {

      markTeaBreakNotified(announcementId);

    } else if (import.meta.env.DEV) {

      console.warn(

        '[TeaBreak] Desktop notification skipped — browser permission:',

        typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'

      );

    }

  }, [showNotification, navigate, user?._id, user?.id]);



  const syncActiveTeaBreak = useCallback(async ({ notifyIfActive = false } = {}) => {

    try {

      const { data } = await api.get('/tea-break/active');

      if (data?.active) {

        applyActiveTeaBreak(data);

        if (notifyIfActive) {

          showTeaBreakDesktopNotification(data);

        }

      } else {

        setTeaBreakData(null);

      }

    } catch (err) {

      console.error('[TeaBreak] Failed to fetch active tea break:', err);

    }

  }, [applyActiveTeaBreak, showTeaBreakDesktopNotification]);



  useEffect(() => {

    if (!token || typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {

      requestPermission();

    }

  }, [token, requestPermission]);



  useEffect(() => {

    if (!token || authStatus !== 'authenticated') return;

    syncActiveTeaBreak({ notifyIfActive: true });

  }, [token, authStatus, syncActiveTeaBreak]);



  useEffect(() => {

    if (!token || authStatus !== 'authenticated') return;



    const handleTeaBreakStarted = () => {

      syncActiveTeaBreak({ notifyIfActive: true });

    };



    const handleTeaBreakStopped = (data) => {

      const announcementId = normalizeAnnouncementId(data?.announcementId);

      if (announcementId) {

        dismissTeaBreak(announcementId);

      } else {

        setTeaBreakData(null);

      }

    };



    const handleSocketConnect = () => {

      syncActiveTeaBreak({ notifyIfActive: false });

    };



    const handleDashboardRefresh = () => {

      syncActiveTeaBreak({ notifyIfActive: false });

    };



    socket.on('tea_break_started', handleTeaBreakStarted);

    socket.on('tea_break_stopped', handleTeaBreakStopped);

    socket.on('connect', handleSocketConnect);

    window.addEventListener('dashboard-refresh-requested', handleDashboardRefresh);



    if (socket.connected) {

      syncActiveTeaBreak({ notifyIfActive: false });

    }



    return () => {

      socket.off('tea_break_started', handleTeaBreakStarted);

      socket.off('tea_break_stopped', handleTeaBreakStopped);

      socket.off('connect', handleSocketConnect);

      window.removeEventListener('dashboard-refresh-requested', handleDashboardRefresh);

    };

  }, [

    token,

    authStatus,

    dismissTeaBreak,

    syncActiveTeaBreak,

  ]);



  const value = useMemo(

    () => ({ teaBreakData, clearTeaBreak, setTeaBreakData, dismissTeaBreak, syncActiveTeaBreak }),

    [teaBreakData, clearTeaBreak, dismissTeaBreak, syncActiveTeaBreak]

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

