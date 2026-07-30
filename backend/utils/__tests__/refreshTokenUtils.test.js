// backend/utils/__tests__/refreshTokenUtils.test.js
//
// Tests for refresh-token rotation race-condition fix.
// Key invariant: two concurrent rotateRefreshToken() calls for the SAME raw
// token must result in exactly one success and one clearly-distinguishable
// "already rotated" error — never two successes.

const mongoose = require('mongoose');

// ─── Mock the RefreshToken model ─────────────────────────────────────────────
// We simulate the atomic findOneAndUpdate behaviour in-memory so the test
// runs without a real MongoDB connection.

let storedTokens = new Map(); // tokenHash → document

const mockFindOneAndUpdate = jest.fn(async (filter, update, options) => {
    const { tokenHash, revoked: filterRevoked } = filter;
    const doc = storedTokens.get(tokenHash);

    // Guard: only match if revoked === false (mirrors the atomic DB write)
    if (!doc || doc.revoked !== filterRevoked) {
        return null; // Atomic write "missed" — someone else already revoked it
    }

    // options.new = false → return pre-update document
    const preCopy = { ...doc };

    // Apply the update
    const set = update.$set || {};
    Object.assign(doc, set);

    return preCopy; // pre-update doc (new: false)
});

const mockFindOne = jest.fn(async (filter) => {
    const { tokenHash } = filter;
    return storedTokens.get(tokenHash) || null;
});

const mockCreate = jest.fn(async (data) => {
    storedTokens.set(data.tokenHash, { ...data });
    return data;
});

jest.mock('../../models/RefreshToken', () => ({
    findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args),
    findOne: (...args) => {
        // findOne returns an object with .lean() support AND is itself awaitable
        const result = mockFindOne(...args);
        const wrapper = {
            lean: () => result,
            then: (resolve, reject) => result.then(resolve, reject),
            catch: (reject) => result.catch(reject),
        };
        return wrapper;
    },
    create: (...args) => mockCreate(...args),
}));

// ─── Import after mocks are set up ───────────────────────────────────────────
const {
    RefreshTokenReuseError,
    issueRefreshToken,
    rotateRefreshToken,
    hashRefreshToken,
} = require('../refreshTokenUtils');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const FAKE_USER_ID = new mongoose.Types.ObjectId();

function seedToken(rawToken, overrides = {}) {
    const tokenHash = hashRefreshToken(rawToken);
    const doc = {
        userId: FAKE_USER_ID,
        tokenHash,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
        replacedByTokenHash: null,
        userAgent: null,
        authMethod: 'local',
        ...overrides,
    };
    storedTokens.set(tokenHash, doc);
    return doc;
}

// ─── Test setup ──────────────────────────────────────────────────────────────
beforeEach(() => {
    storedTokens.clear();
    mockFindOneAndUpdate.mockClear();
    mockFindOne.mockClear();
    mockCreate.mockClear();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('rotateRefreshToken – concurrent rotation race condition', () => {
    test(
        'Two concurrent calls with the same raw token: exactly one succeeds, ' +
        'the other throws a distinguishable "already rotated" error',
        async () => {
            const rawToken = 'a'.repeat(80); // deterministic raw token for test
            seedToken(rawToken);

            // Fire both calls at exactly the same tick (no await between them)
            const [result1, result2] = await Promise.allSettled([
                rotateRefreshToken(rawToken),
                rotateRefreshToken(rawToken),
            ]);

            const successes = [result1, result2].filter(r => r.status === 'fulfilled');
            const failures  = [result1, result2].filter(r => r.status === 'rejected');

            // ── Exactly one success ──────────────────────────────────────────
            expect(successes).toHaveLength(1);
            const { newRawToken, userId, authMethod } = successes[0].value;
            expect(typeof newRawToken).toBe('string');
            expect(newRawToken).toHaveLength(80); // 40 random bytes → 80 hex chars
            expect(userId).toBe(FAKE_USER_ID.toString());
            expect(authMethod).toBe('local');

            // ── Exactly one failure ──────────────────────────────────────────
            expect(failures).toHaveLength(1);
            const { reason } = failures[0];

            // Must be a RefreshTokenReuseError specifically — not a generic Error
            // (the route handler relies on instanceof to decide the response)
            expect(reason).toBeInstanceOf(RefreshTokenReuseError);
            expect(reason.name).toBe('RefreshTokenReuseError');
        }
    );

    test(
        'Single call with a valid token succeeds and returns expected shape',
        async () => {
            const rawToken = 'b'.repeat(80);
            seedToken(rawToken);

            const result = await rotateRefreshToken(rawToken);

            expect(result).toHaveProperty('newRawToken');
            expect(result).toHaveProperty('userId');
            expect(result).toHaveProperty('authMethod');
            expect(result.userId).toBe(FAKE_USER_ID.toString());
        }
    );

    test(
        'Calling with a token that does not exist throws a plain Error (not ReuseError)',
        async () => {
            const rawToken = 'c'.repeat(80); // never seeded

            await expect(rotateRefreshToken(rawToken)).rejects.toThrow('Refresh token not found');
            await expect(rotateRefreshToken(rawToken)).rejects.not.toThrow(RefreshTokenReuseError);
        }
    );

    test(
        'Calling with an already-rotated token (revoked + replacedByTokenHash set) throws RefreshTokenReuseError',
        async () => {
            const rawToken = 'd'.repeat(80);
            // Seed as already-rotated (simulates a previously consumed token)
            seedToken(rawToken, {
                revoked: true,
                replacedByTokenHash: 'e'.repeat(64), // fake successor hash
            });

            await expect(rotateRefreshToken(rawToken)).rejects.toBeInstanceOf(RefreshTokenReuseError);
        }
    );

    test(
        'Calling with a token revoked by logout (revoked=true, no replacedByTokenHash) throws plain Error',
        async () => {
            const rawToken = 'f'.repeat(80);
            seedToken(rawToken, { revoked: true, replacedByTokenHash: null });

            const rejection = rotateRefreshToken(rawToken);
            await expect(rejection).rejects.not.toBeInstanceOf(RefreshTokenReuseError);
            await expect(rejection).rejects.toThrow('Refresh token has been revoked');
        }
    );

    test(
        'Calling with an expired token throws plain Error (not ReuseError)',
        async () => {
            const rawToken = 'g'.repeat(80);
            seedToken(rawToken, {
                expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
            });

            const rejection = rotateRefreshToken(rawToken);
            await expect(rejection).rejects.not.toBeInstanceOf(RefreshTokenReuseError);
            await expect(rejection).rejects.toThrow('Refresh token has expired');
        }
    );
});
