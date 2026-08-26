'use strict';
// middleware/errorHandler.js — mirrors AMS pattern

const { logError } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logError(err, { path: req.path, method: req.method, user: req.user?.userId });

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: Object.values(err.errors).map(e => ({ field: e.path, message: e.message })),
        });
    }
    if (err.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid ID format', field: err.path });
    }
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0] || 'unknown';
        return res.status(409).json({ error: `Duplicate value for ${field}` });
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Authentication failed' });
    }

    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};

module.exports = errorHandler;
