import api from '../api/axios';

const SW_URL = '/sw.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  );
}

async function fetchVapidPublicKey() {
  const { data } = await api.get('/push/vapid-public-key');
  if (!data?.enabled || !data?.publicKey) {
    return null;
  }
  return data.publicKey;
}

async function registerPushServiceWorker() {
  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) {
    registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  }
  await navigator.serviceWorker.ready;
  return registration;
}

async function getPushSubscription(registration) {
  return registration.pushManager.getSubscription();
}

/**
 * Subscribe the current browser to Web Push and persist on the server.
 * Call after Notification.permission is "granted".
 */
export async function subscribeToWebPush() {
  if (!isWebPushSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, reason: 'permission_denied' };
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    return { success: false, reason: 'not_configured' };
  }

  const registration = await registerPushServiceWorker();
  await navigator.serviceWorker.ready;

  let subscription = await getPushSubscription(registration);
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.post('/push/subscribe', { subscription: subscription.toJSON() });
  return { success: true, endpoint: subscription.endpoint };
}

/**
 * Request notification permission, then subscribe if granted.
 */
export async function enableWebPushNotifications() {
  if (!isWebPushSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  if (Notification.permission === 'denied') {
    return { success: false, reason: 'permission_denied' };
  }

  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      return { success: false, reason: 'permission_denied' };
    }
  }

  return subscribeToWebPush();
}

/**
 * Re-sync subscription if permission is already granted (e.g. on login).
 */
export async function syncWebPushSubscription() {
  if (!isWebPushSupported() || Notification.permission !== 'granted') {
    return { success: false, reason: 'skipped' };
  }
  return subscribeToWebPush();
}

export async function unsubscribeFromWebPush() {
  if (!isWebPushSupported()) return { success: false };

  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return { success: true };

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { success: true };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  try {
    await api.delete('/push/subscribe', { data: { endpoint } });
  } catch (_) {
    /* best effort */
  }
  return { success: true };
}
