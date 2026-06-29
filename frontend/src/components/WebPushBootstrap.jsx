import { useEffect } from 'react';
import useWebPush from '../hooks/useWebPush';

/**
 * Registers Web Push after login and handles notification click messages from the SW.
 */
export default function WebPushBootstrap() {
  useWebPush();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    const onMessage = (event) => {
      if (event.data?.type !== 'PUSH_NOTIFICATION_CLICK') return;
      const url = event.data?.data?.url;
      if (!url || typeof url !== 'string') return;
      const path = url.startsWith('/') ? url : `/${url}`;
      if (window.location.pathname !== path) {
        window.location.href = path;
      } else {
        window.focus();
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return null;
}
