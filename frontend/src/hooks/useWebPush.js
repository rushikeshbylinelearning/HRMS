import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  enableWebPushNotifications,
  isWebPushSupported,
  syncWebPushSubscription,
} from '../services/webPushService';

/**
 * Registers Web Push after authentication so tea-break alerts reach the OS
 * even when the AMS tab is in the background.
 */
export default function useWebPush() {
  const auth = useAuth();
  const user = auth?.user;
  const authStatus = auth?.authStatus;
  const promptedRef = useRef(false);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) return;
    if (!isWebPushSupported()) return;

    const run = async () => {
      try {
        if (Notification.permission === 'granted') {
          await syncWebPushSubscription();
          return;
        }

        if (Notification.permission === 'default' && !promptedRef.current) {
          promptedRef.current = true;
          const result = await enableWebPushNotifications();
          if (import.meta.env.DEV && result.reason === 'not_configured') {
            console.info('[WebPush] Server VAPID keys not configured — skipping subscription');
          }
        }
      } catch (err) {
        console.error('[WebPush] Subscription failed:', err);
      }
    };

    const timer = setTimeout(run, 2500);
    return () => clearTimeout(timer);
  }, [authStatus, user?.id, user?._id]);
}
