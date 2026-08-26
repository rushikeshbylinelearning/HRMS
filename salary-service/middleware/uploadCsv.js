'use strict';
// middleware/uploadCsv.js
//
// Busboy-based CSV upload middleware.
// Reads the file field named 'file', buffers its contents, and attaches:
//   req.file = { buffer: Buffer, originalname: string, mimetype: string }
//
// Allowed: .csv files only. Max size: 5 MB.

const busboy = require('busboy');
const path   = require('path');

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function uploadCsv(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }

    const chunks = [];
    let originalname = 'upload.csv';
    let mimetype     = 'text/csv';
    let totalSize    = 0;
    let foundFile    = false;
    let rejected     = false;

    function sendError(status, message) {
        if (rejected) return;
        rejected = true;
        try { bb.destroy(); } catch (_) {}
        return res.status(status).json({ error: message });
    }

    const bb = busboy({
        headers: { 'content-type': contentType },
        limits:  { fileSize: MAX_SIZE + 1, files: 1, fields: 10 },
    });

    bb.on('file', (fieldname, file, info) => {
        if (fieldname !== 'file') { file.resume(); return; }
        foundFile    = true;
        originalname = info.filename || 'upload.csv';
        mimetype     = info.mimeType || 'text/csv';

        const ext = path.extname(originalname).toLowerCase();
        if (ext !== '.csv') {
            sendError(400, 'Only CSV files are accepted');
            file.destroy();
            return;
        }

        file.on('data', (chunk) => {
            if (rejected) return;
            totalSize += chunk.length;
            if (totalSize > MAX_SIZE) {
                sendError(413, 'File exceeds 5 MB limit');
                file.destroy();
                return;
            }
            chunks.push(chunk);
        });
        file.on('limit', () => { if (!rejected) sendError(413, 'File exceeds 5 MB limit'); });
        file.on('error', () => { if (!rejected) sendError(500, 'Error reading file'); });
    });

    bb.on('finish', () => {
        if (rejected) return;
        if (!foundFile || chunks.length === 0) {
            return sendError(400, 'No CSV file provided under field name "file"');
        }
        req.file = {
            buffer:       Buffer.concat(chunks),
            originalname,
            mimetype,
        };
        next();
    });

    bb.on('error', () => { if (!rejected) sendError(400, 'Invalid multipart request'); });
    req.pipe(bb);
}

module.exports = uploadCsv;
