'use strict';
// utils/logger.js
// Winston logger — mirrors AMS pattern with service name changed.
const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'salary-service' },
    transports: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 5_242_880, // 5 MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/combined.log'),
            maxsize: 5_242_880,
            maxFiles: 5,
        }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

// Request logger middleware — only logs errors and slow requests in production
const requestLogger = (req, res, next) => {
    const skipPaths = ['/health'];
    if (process.env.NODE_ENV === 'production' && skipPaths.some(p => req.url.startsWith(p))) {
        return next();
    }
    const start = Date.now();
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - start;
        if (res.statusCode >= 400 || duration > 1000) {
            logger.info('Request', {
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
            });
        }
        originalEnd.call(this, chunk, encoding);
    };
    next();
};

const logError = (error, context = {}) => {
    logger.error('Application Error', {
        message: error.message,
        stack: error.stack,
        ...context,
    });
};

module.exports = { logger, requestLogger, logError };
