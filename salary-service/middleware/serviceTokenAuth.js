'use strict';
// middleware/serviceTokenAuth.js
//
// Verifies the service-to-service token sent by external callers (e.g. the
// AMS internal feed responding to salary-service requests).
//
// This middleware is for routes that salary-service exposes to AMS
// (NOT for human user sessions).  It uses a different secret (SERVICE_TOKEN)
// from the JWT secret so a bug in one auth path cannot expose the other.

const crypto = require('crypto');

// Constant-time comparison to prevent timing attacks
function safeCompare(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
        // Still run timingSafeEqual on equally-sized buffers to avoid timing leak
        crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

function serviceTokenAuth(req, res, next) {
    const provided = req.headers['x-service-token'];
    const expected = process.env.SERVICE_TOKEN;

    if (!provided) {
        return res.status(401).json({ error: 'Service token required' });
    }

    if (!safeCompare(provided, expected)) {
        return res.status(403).json({ error: 'Invalid service token' });
    }

    next();
}

module.exports = serviceTokenAuth;
