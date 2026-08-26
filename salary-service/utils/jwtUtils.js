'use strict';
// utils/jwtUtils.js
//
// HS256 token signing/verification for salary-service.
//
// Why HS256 and not RS256:
//   salary-service is both the only issuer and the only verifier of its own
//   tokens.  RS256 + JWKS is appropriate when multiple independent parties need
//   to verify tokens without sharing a secret (AMS + SSO portal use that pattern
//   because they need to interoperate).  That constraint does not exist here.
//   A single long random secret (JWT_SECRET, 64+ bytes, no fallback) does the
//   same job with one fewer moving part — no keypair file, no JWKS endpoint,
//   no jwks-rsa dependency.  Upgrading to RS256 later is a contained change.
//
// Missing JWT_SECRET → process refused to start (envValidator.js catches it first).
// There is NO || 'fallback' pattern anywhere in this file.

const jwt = require('jsonwebtoken');

function getSecret() {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET is not set — process should have refused to start');
    return s;
}

/**
 * Signs an access token.
 * @param {object} payload
 * @param {object} [options]  — passed to jwt.sign; override expiresIn here
 * @returns {string} signed JWT
 */
function sign(payload, options = {}) {
    return jwt.sign(payload, getSecret(), {
        algorithm: 'HS256',
        expiresIn: options.expiresIn || process.env.JWT_EXPIRES_IN || '15m',
        ...options,
    });
}

/**
 * Verifies and decodes a token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {JsonWebTokenError|TokenExpiredError}
 */
function verify(token) {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

module.exports = { sign, verify };
