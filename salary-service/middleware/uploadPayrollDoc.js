'use strict';
// middleware/uploadPayrollDoc.js
//
// Busboy-based multipart upload middleware for payroll document uploads.
// Validates extension, reported MIME, and magic bytes then attaches
// validated buffer to req.payrollUpload for the controller.
//
// Allowed types: PDF only (salary slips and attachments are all PDFs).
// Max size: 10 MB.

const busboy = require('busboy');
const path = require('path');

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXT = ['.pdf'];
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

function uploadPayrollDoc(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }
    if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const chunks = [];
    let originalFileName = '';
    let reportedMime = '';
    let totalSize = 0;
    let foundFile = false;
    let rejected = false;
    const formFields = {};

    function sendError(status, message) {
        if (rejected) return;
        rejected = true;
        try { bb.destroy(); } catch (_) {}
        return res.status(status).json({ error: message });
    }

    const bb = busboy({
        headers: { 'content-type': contentType },
        limits: { fileSize: MAX_SIZE + 1, files: 1, fields: 10 },
    });

    bb.on('field', (name, val) => { formFields[name] = val; });

    bb.on('file', (fieldname, file, info) => {
        if (fieldname !== 'file') { file.resume(); return; }
        foundFile = true;
        originalFileName = info.filename || 'upload.pdf';
        reportedMime = (info.mimeType || '').toLowerCase();

        const ext = path.extname(originalFileName).toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
            sendError(400, 'Only PDF files are accepted'); file.destroy(); return;
        }
        if (reportedMime && reportedMime !== 'application/pdf' && reportedMime !== 'application/octet-stream') {
            sendError(400, 'MIME type must be application/pdf'); file.destroy(); return;
        }

        file.on('data', (chunk) => {
            if (rejected) return;
            totalSize += chunk.length;
            if (totalSize > MAX_SIZE) {
                sendError(413, 'File exceeds 10 MB limit'); file.destroy(); return;
            }
            chunks.push(chunk);
        });
        file.on('limit', () => { if (!rejected) sendError(413, 'File exceeds 10 MB limit'); });
        file.on('error', () => { if (!rejected) sendError(500, 'Error reading file'); });
    });

    bb.on('filesLimit', () => { if (!rejected) sendError(400, 'Only one file per request'); });

    bb.on('finish', () => {
        if (rejected) return;
        if (!foundFile || chunks.length === 0) {
            return sendError(400, 'No file provided under field name "file"');
        }
        const buffer = Buffer.concat(chunks);
        // Magic byte check
        if (buffer.length < 4 || !buffer.slice(0, 4).equals(PDF_MAGIC)) {
            return sendError(400, 'File content does not appear to be a valid PDF');
        }
        req.payrollUpload = {
            buffer,
            originalFileName,
            mimeType: 'application/pdf',
            fileSize: buffer.length,
        };
        req.payrollFormFields = formFields;
        next();
    });

    bb.on('error', () => { if (!rejected) sendError(400, 'Invalid multipart request'); });
    req.pipe(bb);
}

module.exports = uploadPayrollDoc;
