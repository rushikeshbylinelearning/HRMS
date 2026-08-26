'use strict';
// utils/encryption.js
//
// AES-256-GCM encryption/decryption for EmployeeFinancialProfile sensitive fields
// (bankAccountNumber, ifscCode, panNumber, uan/pfNumber).
//
// Key source: ENCRYPTION_KEY env var (32 bytes as 64-char hex string).
// Missing key → process already refused to start (envValidator.js).
// There is NO fallback key here — that is the exact fix for F-HIGH-002.
//
// Storage format: "iv:authTag:ciphertext" — all hex-encoded, colon-delimited.
// This is a self-describing format so decryption is stateless per-field.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;     // 96-bit IV — recommended for GCM
const TAG_BYTES = 16;    // 128-bit auth tag

let _key = null;

/**
 * Returns the encryption key Buffer.
 * Lazy-loaded once; the env var is guaranteed present by envValidator.
 */
function getKey() {
    if (_key) return _key;
    const hexKey = process.env.ENCRYPTION_KEY;
    if (!hexKey || hexKey.length < 64) {
        // This should never be reached in normal operation (envValidator fires first)
        // but is a belt-and-suspenders guard.
        throw new Error('ENCRYPTION_KEY is missing or too short — process should have refused to start');
    }
    _key = Buffer.from(hexKey.slice(0, 64), 'hex');
    if (_key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes');
    }
    return _key;
}

/**
 * Encrypts a plaintext string.
 * @param {string} plaintext
 * @returns {string} "iv:authTag:ciphertext" (hex-encoded, colon-delimited)
 */
function encrypt(plaintext) {
    if (plaintext === null || plaintext === undefined) return null;
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a value previously returned by encrypt().
 * @param {string} stored  "iv:authTag:ciphertext"
 * @returns {string} plaintext
 * @throws if the stored value is malformed or authentication fails
 */
function decrypt(stored) {
    if (stored === null || stored === undefined) return null;
    const parts = String(stored).split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted value format — expected "iv:authTag:ciphertext"');
    }
    const [ivHex, tagHex, ctHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ctHex, 'hex');

    if (iv.length !== IV_BYTES) throw new Error('Invalid IV length in stored value');
    if (tag.length !== TAG_BYTES) throw new Error('Invalid auth tag length in stored value');

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
