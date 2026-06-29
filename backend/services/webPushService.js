const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let configured = false;

function configureWebPush() {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || process.env.MAIL_FROM || 'mailto:admin@bylinelms.com';

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

function isWebPushEnabled() {
  return configureWebPush();
}

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

async function upsertSubscription(userId, subscription, userAgent = '') {
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Invalid push subscription payload');
  }

  return PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      userId,
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      userAgent: userAgent || '',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function removeSubscription(userId, endpoint) {
  if (!endpoint) return { deletedCount: 0 };
  return PushSubscription.deleteOne({ userId, endpoint });
}

async function removeStaleSubscription(endpoint) {
  if (!endpoint) return;
  try {
    await PushSubscription.deleteOne({ endpoint });
  } catch (err) {
    console.error('[WebPush] Failed to remove stale subscription:', err.message);
  }
}

async function sendToSubscription(subscriptionDoc, payload) {
  if (!configureWebPush()) return { sent: false, reason: 'not_configured' };

  const pushSubscription = {
    endpoint: subscriptionDoc.endpoint,
    keys: {
      p256dh: subscriptionDoc.keys.p256dh,
      auth: subscriptionDoc.keys.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { sent: true };
  } catch (err) {
    const status = err.statusCode || err.status;
    if (status === 404 || status === 410) {
      await removeStaleSubscription(subscriptionDoc.endpoint);
      return { sent: false, reason: 'expired', status };
    }
    console.error('[WebPush] Send failed:', err.message);
    return { sent: false, reason: 'error', status };
  }
}

/**
 * Send Web Push to all subscriptions for the given user IDs.
 * @param {string[]} userIds
 * @param {object} payload - { title, body, url, tag, announcementId, requireInteraction }
 */
async function sendPushToUsers(userIds, payload) {
  if (!configureWebPush() || !userIds?.length) {
    return { sent: 0, failed: 0, skipped: userIds?.length || 0 };
  }

  const uniqueIds = [...new Set(userIds.map((id) => String(id)))];
  const subscriptions = await PushSubscription.find({ userId: { $in: uniqueIds } }).lean();

  if (!subscriptions.length) {
    return { sent: 0, failed: 0, skipped: uniqueIds.length, noSubscriptions: true };
  }

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendToSubscription(sub, payload);
      if (result.sent) sent += 1;
      else failed += 1;
    })
  );

  return { sent, failed, total: subscriptions.length };
}

async function notifyTeaBreakStartedPush(userIds, { teaBreakType, announcementId, initiatedByUserId }) {
  const label = teaBreakType === 'evening' ? 'Evening' : 'Morning';
  const payload = {
    title: '☕ Tea Break Started!',
    body: `${label} tea break — 10 minutes starting now.`,
    url: '/dashboard',
    tag: announcementId ? `tea-break-${announcementId}` : 'tea-break',
    announcementId: announcementId ? String(announcementId) : null,
    type: 'TEA_BREAK_STARTED',
    initiatedByUserId: initiatedByUserId ? String(initiatedByUserId) : null,
    requireInteraction: true,
    icon: '/BL.svg',
  };

  const filtered = initiatedByUserId
    ? userIds.filter((id) => String(id) !== String(initiatedByUserId))
    : userIds;

  const result = await sendPushToUsers(filtered, payload);
  if (result.sent > 0 || result.total > 0) {
    console.log(
      `[WebPush] Tea break push: ${result.sent} sent, ${result.failed} failed (${result.total || 0} subscriptions)`
    );
  }
  return result;
}

module.exports = {
  isWebPushEnabled,
  getVapidPublicKey,
  upsertSubscription,
  removeSubscription,
  sendPushToUsers,
  notifyTeaBreakStartedPush,
};
