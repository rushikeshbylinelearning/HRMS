const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const {
  getVapidPublicKey,
  isWebPushEnabled,
  upsertSubscription,
  removeSubscription,
} = require('../services/webPushService');

const router = express.Router();

router.get('/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({
      enabled: false,
      message: 'Web Push is not configured on this server',
    });
  }
  res.json({ enabled: true, publicKey });
});

router.get('/status', authenticateToken, (req, res) => {
  res.json({ enabled: isWebPushEnabled() });
});

router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    if (!isWebPushEnabled()) {
      return res.status(503).json({ message: 'Web Push is not configured' });
    }

    const subscription = req.body?.subscription || req.body;
    const userAgent = req.headers['user-agent'] || '';

    await upsertSubscription(req.user.userId, subscription, userAgent);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[WebPush] Subscribe error:', err.message);
    res.status(400).json({ message: err.message || 'Invalid subscription' });
  }
});

router.delete('/subscribe', authenticateToken, async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) {
      return res.status(400).json({ message: 'endpoint is required' });
    }
    await removeSubscription(req.user.userId, endpoint);
    res.json({ success: true });
  } catch (err) {
    console.error('[WebPush] Unsubscribe error:', err.message);
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
});

module.exports = router;
