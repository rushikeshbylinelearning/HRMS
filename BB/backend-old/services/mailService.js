// backend/services/mailService.js
const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

let transporterPromise = null;
let lastVerifyAt = null;

const TRANSIENT_ERROR_CODES = new Set([
    'ETIMEDOUT',
    'ECONNECTION',
    'EHOSTUNREACH',
    'ECONNRESET',
    'ENETUNREACH',
    'EAI_AGAIN'
]);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const redactEmail = (email) => {
    if (!email || typeof email !== 'string') return email;
    const trimmed = email.trim();
    const at = trimmed.indexOf('@');
    if (at <= 1) return '***';
    return `${trimmed.slice(0, 2)}***${trimmed.slice(at)}`;
};

const normalizeRecipientsForLog = (to) => {
    if (!to) return to;
    if (Array.isArray(to)) return to.map(redactEmail);
    if (typeof to === 'string') {
        return to.split(',').map(s => redactEmail(s)).join(',');
    }
    return to;
};

const getMailFromAddress = () => {
    // Preserve existing behavior (sender = MAIL_USER) but allow MAIL_FROM override if provided.
    // This does not change provider; it's a safer config option.
    const fromAddr = (process.env.MAIL_FROM || process.env.MAIL_USER || '').trim();
    return `"AMS Portal" <${fromAddr}>`;
};

const ensureMailConfiguredOrThrow = () => {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) return;

    // In production, we fail fast if mail is intended to be used.
    // If all emails are disabled, allow startup.
    if (process.env.DISABLE_ALL_EMAILS === 'true') {
        console.log('[MAIL CONFIG] All emails disabled - skipping mail configuration check');
        return;
    }

    const missing = [];
    if (!process.env.MAIL_HOST) missing.push('MAIL_HOST');
    if (!process.env.MAIL_PORT) missing.push('MAIL_PORT');
    if (!process.env.MAIL_USER) missing.push('MAIL_USER');
    if (!process.env.MAIL_PASS) missing.push('MAIL_PASS');
    if (missing.length > 0) {
        const msg = `[MAIL CONFIG] Missing required production mail env vars: ${missing.join(', ')}`;
        console.error(msg);
        console.error('[MAIL CONFIG] Set DISABLE_ALL_EMAILS=true to skip mail configuration');
        // Throw to prevent silent production misconfig - but only if emails are expected to work
        throw new Error(msg);
    }
};

const createPooledTransporter = async () => {
    // Defensive check - if emails are disabled, return a mock transporter
    if (process.env.DISABLE_ALL_EMAILS === 'true') {
        console.log('[MAIL CONFIG] All emails disabled - returning mock transporter');
        return {
            verify: async () => {
                console.log('[MAIL MOCK] Mock transporter verification - always succeeds');
                return true;
            },
            sendMail: async (options) => {
                console.log('[MAIL MOCK] Mock email send:', {
                    to: options.to,
                    subject: options.subject
                });
                return { messageId: 'mock-' + Date.now() };
            }
        };
    }

    try {
        ensureMailConfiguredOrThrow();
    } catch (configError) {
        console.error('[MAIL CONFIG] Configuration check failed:', configError.message);
        // Return mock transporter instead of crashing
        console.warn('[MAIL CONFIG] Returning mock transporter to prevent startup crash');
        return {
            verify: async () => {
                throw new Error('Mail not configured: ' + configError.message);
            },
            sendMail: async (options) => {
                throw new Error('Mail not configured: ' + configError.message);
            }
        };
    }

    // Dev fallback stays available, but only when MAIL_HOST is not configured.
    if (!process.env.MAIL_HOST) {
        try {
            const testAccount = await nodemailer.createTestAccount();
            logger.warn('[MAIL CONFIG] No real SMTP configured; using Ethereal test account');
            return nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        } catch (etherealError) {
            console.error('[MAIL CONFIG] Ethereal test account creation failed:', etherealError.message);
            // Return mock transporter as final fallback
            return {
                verify: async () => {
                    throw new Error('No mail configuration available');
                },
                sendMail: async (options) => {
                    throw new Error('No mail configuration available');
                }
            };
        }
    }

    const port = Number(process.env.MAIL_PORT);
    const secure = process.env.MAIL_SECURE === 'true';

    return nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port,
        secure,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
        pool: true,
        maxConnections: Number(process.env.MAIL_POOL_MAX_CONNECTIONS || 5),
        maxMessages: Number(process.env.MAIL_POOL_MAX_MESSAGES || 100),
        connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 15000),
        greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 15000),
        socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 30000),
    });
};

const getTransporter = async () => {
    if (!transporterPromise) {
        transporterPromise = createPooledTransporter();
    }
    return transporterPromise;
};

const verifyTransporterOnce = async () => {
    try {
        // Check if emails are disabled first
        if (process.env.DISABLE_ALL_EMAILS === 'true') {
            console.log('[MAIL VERIFY] All emails disabled - skipping SMTP verification');
            lastVerifyAt = new Date();
            return;
        }

        const t = await getTransporter();
        await t.verify();
        lastVerifyAt = new Date();
        logger.info('[MAIL VERIFY] SMTP verified successfully', {
            at: lastVerifyAt.toISOString()
        });
    } catch (verifyError) {
        console.error('[MAIL VERIFY] SMTP verification failed:', verifyError.message);
        // Don't throw - let the server continue
        // Mail service will handle individual send failures gracefully
        console.warn('[MAIL VERIFY] Server will continue but email functionality may be limited');
        console.warn('[MAIL VERIFY] Set DISABLE_ALL_EMAILS=true to disable email completely');
        
        // Set lastVerifyAt to indicate verification was attempted but failed
        lastVerifyAt = new Date();
        
        // Re-throw only in production if emails are expected to work
        if (process.env.NODE_ENV === 'production' && process.env.DISABLE_ALL_EMAILS !== 'true') {
            throw new Error(`SMTP verification failed in production: ${verifyError.message}. Set DISABLE_ALL_EMAILS=true to disable email.`);
        }
    }
};

const isTransientError = (err) => {
    if (!err) return false;
    if (err.code && TRANSIENT_ERROR_CODES.has(err.code)) return true;
    // Some nodemailer/network errors show up under errno
    if (err.errno && TRANSIENT_ERROR_CODES.has(err.errno)) return true;
    return false;
};

const classifySkipReason = ({ isHREmail }) => {
    if (process.env.DISABLE_ALL_EMAILS === 'true') return 'ALL_EMAILS_DISABLED';
    if (isHREmail && process.env.DISABLE_HR_EMAILS === 'true') return 'HR_EMAILS_DISABLED';
    return null;
};

/**
 * sendEmail
 *
 * Backward compatible signature.
 * Additional optional fields are supported for observability.
 */
const sendEmail = async ({
    to,
    subject,
    text,
    html,
    isHREmail = false,
    mailType,
    recipientType,
    requestId,
} = {}) => {
    const skipReason = classifySkipReason({ isHREmail });
    const effectiveMailType = mailType || 'Unknown';
    const effectiveRecipientType = recipientType || (isHREmail ? 'hr' : 'employee');

    if (skipReason) {
        logger.warn('[MAIL SKIPPED]', {
            reason: skipReason,
            mailType: effectiveMailType,
            recipientType: effectiveRecipientType,
            to: normalizeRecipientsForLog(to),
            subject,
            requestId: requestId || null,
        });
        return;
    }

    logger.info('[MAIL ATTEMPT]', {
        mailType: effectiveMailType,
        recipientType: effectiveRecipientType,
        to: normalizeRecipientsForLog(to),
        subject,
        requestId: requestId || null,
        verifiedAt: lastVerifyAt ? lastVerifyAt.toISOString() : null,
    });

    const MAX_ATTEMPTS = 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_ATTEMPTS) {
        attempt += 1;
        try {
            const transporter = await getTransporter();
            const info = await transporter.sendMail({
                from: getMailFromAddress(),
                to,
                subject,
                text,
                html,
            });

            logger.info('[MAIL SENT]', {
                mailType: effectiveMailType,
                recipientType: effectiveRecipientType,
                to: normalizeRecipientsForLog(to),
                subject,
                requestId: requestId || null,
                messageId: info && info.messageId ? info.messageId : null,
                attempt,
            });
            return;
        } catch (error) {
            lastError = error;

            const transient = isTransientError(error);
            logger.error('[MAIL FAILED]', {
                mailType: effectiveMailType,
                recipientType: effectiveRecipientType,
                to: normalizeRecipientsForLog(to),
                subject,
                requestId: requestId || null,
                attempt,
                maxAttempts: MAX_ATTEMPTS,
                transient,
                code: error && error.code ? error.code : null,
                message: error && error.message ? error.message : String(error),
            });

            if (!transient || attempt >= MAX_ATTEMPTS) break;
            const backoffMs = 500 * Math.pow(2, attempt - 1);
            await sleep(backoffMs);
        }
    }

    throw lastError;
};

module.exports = {
    sendEmail,
    verifyTransporterOnce,
};