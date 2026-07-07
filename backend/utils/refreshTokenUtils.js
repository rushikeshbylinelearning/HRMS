// backend/utils/refreshTokenUtils.js
// Utilities for issuing, rotating, and revoking opaque refresh tokens.
//
// Design decisions:
//   - Refresh tokens are opaque random bytes, NOT JWTs.
//   - Only the SHA-256 hash of the raw token is stored in MongoDB.
//   - The raw token is returned to the client exactly once (at issuance)
//     and sent back via an httpOnly cookie — never readable by JS.
//   - Token rotation: each use of a refresh token invalidates the old one
//     and issues a new one (rolling rotation).
//   - Reuse of an already-rotated (revoked) token raises RefreshTokenReuseError
//     and is logged clearly for security review.

const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

// Refresh token lifespan: 7 days (matches the old single-token lifetime)
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Custom error class for detecting possible token theft.
 * Thrown when a refresh token that has already been rotated (i.e., revoked
 * and replaced) is presented again.
 */
class RefreshTokenReuseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RefreshTokenReuseError';
    }
}

/**
 * Generates a cryptographically random opaque refresh token string.
 * 40 bytes → 80 hex characters; sufficient entropy against brute-force.
 * @returns {string} Raw hex token
 */
function generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
}

/**
 * Returns the SHA-256 hash of a raw refresh token for DB storage / lookup.
 * @param {string} rawToken
 * @returns {string} Hex-encoded SHA-256 digest
 */
function hashRefreshToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Issues a new refresh token for a user and persists its hash to MongoDB.
 *
 * @param {string|ObjectId} userId  - AMS User._id
 * @param {'local'|'SSO'} authMethod - Propagated from the access token so
 *                                     the refresh endpoint knows how to
 *                                     re-derive the next access token.
 * @param {string} [userAgent]      - Optional UA string for future device tracking.
 * @returns {Promise<string>}        Raw token to send to the client.
 */
async function issueRefreshToken(userId, authMethod = 'local', userAgent = null) {
    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);

    await RefreshToken.create({
        userId,
        tokenHash,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revoked: false,
        replacedByTokenHash: null,
        userAgent: userAgent || null,
        authMethod,
    });

    return rawToken;
}

/**
 * Validates an incoming refresh token, revokes it, and issues a new one
 * (rolling rotation).
 *
 * @param {string} oldRawToken - The raw token from the client cookie.
 * @returns {Promise<{ newRawToken: string, userId: string, authMethod: string }>}
 * @throws {RefreshTokenReuseError} If the token was already rotated (possible theft).
 * @throws {Error} If the token is not found, expired, or revoked for other reasons.
 */
async function rotateRefreshToken(oldRawToken) {
    const oldHash = hashRefreshToken(oldRawToken);
    const record = await RefreshToken.findOne({ tokenHash: oldHash });

    if (!record) {
        // Token simply doesn't exist — either fabricated or already deleted by TTL.
        throw new Error('Refresh token not found');
    }

    // Check for token reuse (already rotated → possible theft)
    if (record.revoked && record.replacedByTokenHash) {
        // This is the classic "reuse of rotated token" signal.
        // SECURITY NOTE (flagged back per spec): We deliberately do NOT auto-revoke
        // all sessions here. The decision to revoke all of a user's sessions on
        // reuse detection is a security-vs-convenience trade-off that the operator
        // should make explicitly. See RefreshTokenReuseError handling in the route.
        console.error(
            `[RefreshToken] ⚠️  REUSE DETECTED — userId: ${record.userId} | ` +
            `oldHash: ${oldHash.slice(0, 12)}... | ` +
            `replacedBy: ${record.replacedByTokenHash.slice(0, 12)}... | ` +
            `issuedAt: ${record.issuedAt.toISOString()} | ` +
            `This may indicate token theft. Manual review recommended.`
        );
        throw new RefreshTokenReuseError(
            'Refresh token has already been rotated — possible token reuse / theft'
        );
    }

    // Generic revocation (expired, or revoked by logout)
    if (record.revoked) {
        throw new Error('Refresh token has been revoked');
    }

    // Check expiry (belt-and-suspenders — MongoDB TTL handles cleanup but may lag)
    if (record.expiresAt < new Date()) {
        throw new Error('Refresh token has expired');
    }

    // Issue replacement token
    const newRawToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRawToken);

    // Mark old record as rotated
    record.revoked = true;
    record.replacedByTokenHash = newHash;
    await record.save();

    // Persist new token
    await RefreshToken.create({
        userId: record.userId,
        tokenHash: newHash,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revoked: false,
        replacedByTokenHash: null,
        userAgent: record.userAgent,
        authMethod: record.authMethod,
    });

    return {
        newRawToken,
        userId: record.userId.toString(),
        authMethod: record.authMethod,
    };
}

/**
 * Revokes a refresh token (used on logout).
 * Does not issue a replacement. Silently no-ops if the token is not found
 * (idempotent — safe to call on already-expired/deleted tokens).
 *
 * @param {string} rawToken - Raw token from the client cookie.
 * @returns {Promise<void>}
 */
async function revokeRefreshToken(rawToken) {
    if (!rawToken) return;
    const tokenHash = hashRefreshToken(rawToken);
    await RefreshToken.updateOne(
        { tokenHash, revoked: false },
        { $set: { revoked: true } }
    );
}

module.exports = {
    RefreshTokenReuseError,
    generateRefreshToken,
    hashRefreshToken,
    issueRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
};
