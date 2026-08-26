'use strict';
// controllers/folderController.js
//
// B2 folder management panel operations.
// "Folders" in S3-compatible storage are just common key prefixes.
// A "create folder" writes a zero-byte marker object with a trailing-slash key.
//
// SECURITY: All user-supplied folder names and filenames pass through
// sanitizeSegment() from utils/storageKey.js — path traversal into another
// employee's prefix is the obvious attack vector here.

const {
    listObjects,
    createFolderMarker,
    deleteObject,
    deleteFolderRecursive,
    renameObject,
    uploadObject,
    objectExists,
    presignedGetUrl,
} = require('../services/b2Storage');
const { sanitizeSegment, buildSharedFolderMarkerKey, buildSharedFileKey, PREFIX } = require('../utils/storageKey');
const { audit } = require('../services/auditLogger');

// ─── GET /api/folders?prefix=&delimiter= ──────────────────────────────────────
// Lists objects and "folders" (common prefixes) under the given prefix.

async function listFolder(req, res) {
    try {
        let prefix = req.query.prefix || PREFIX;

        // Ensure prefix stays within the service prefix — prevent reaching outside
        if (!prefix.startsWith(PREFIX)) {
            prefix = PREFIX;
        }

        const delimiter      = req.query.delimiter !== undefined ? req.query.delimiter : '/';
        const continuationToken = req.query.nextToken || null;

        const result = await listObjects(prefix, delimiter, continuationToken);
        return res.json(result);
    } catch (err) {
        console.error('[Folder] list:', err.message);
        return res.status(500).json({ error: 'Failed to list folder contents' });
    }
}

// ─── POST /api/folders — create a named shared folder ─────────────────────────

async function createFolder(req, res) {
    const { folderName } = req.body;
    if (!folderName) return res.status(400).json({ error: 'folderName is required' });

    try {
        const markerKey = buildSharedFolderMarkerKey(folderName);
        await createFolderMarker(markerKey);

        await audit({ action: 'FOLDER_CREATED', req, subject: markerKey });
        return res.status(201).json({ key: markerKey });
    } catch (err) {
        if (err.message.includes('empty after sanitisation')) {
            return res.status(400).json({ error: 'Folder name is invalid after sanitisation' });
        }
        console.error('[Folder] create:', err.message);
        return res.status(500).json({ error: 'Failed to create folder' });
    }
}

// ─── DELETE /api/folders — delete a folder and ALL contents (IRREVERSIBLE) ────

async function deleteFolder(req, res) {
    const { prefix } = req.body;
    if (!prefix) return res.status(400).json({ error: 'prefix is required' });

    // Hard guard: never delete outside the payroll prefix
    if (!prefix.startsWith(PREFIX)) {
        return res.status(403).json({ error: 'Cannot delete objects outside the payroll prefix' });
    }

    try {
        const totalDeleted = await deleteFolderRecursive(prefix);

        await audit({ action: 'FOLDER_DELETED', req, subject: prefix, details: { totalDeleted } });
        return res.json({ success: true, totalDeleted });
    } catch (err) {
        console.error('[Folder] delete:', err.message);
        return res.status(500).json({ error: 'Failed to delete folder' });
    }
}

// ─── POST /api/folders/rename — rename/move a single object ──────────────────

async function renameFile(req, res) {
    const { sourceKey, destFolderName, destFileName } = req.body;
    if (!sourceKey || !destFolderName || !destFileName) {
        return res.status(400).json({ error: 'sourceKey, destFolderName, and destFileName are required' });
    }

    // Both keys must stay within the payroll prefix
    if (!sourceKey.startsWith(PREFIX)) {
        return res.status(403).json({ error: 'sourceKey is outside the payroll prefix' });
    }

    const destKey = buildSharedFileKey(destFolderName, destFileName);

    try {
        const exists = await objectExists(sourceKey);
        if (!exists) return res.status(404).json({ error: 'Source object not found' });

        await renameObject(sourceKey, destKey);

        await audit({ action: 'FILE_UPLOADED', req, subject: destKey, details: { movedFrom: sourceKey } });
        return res.json({ sourceKey, destKey });
    } catch (err) {
        console.error('[Folder] rename:', err.message);
        return res.status(500).json({ error: 'Failed to rename/move file' });
    }
}

// ─── DELETE /api/folders/file — delete a single object ────────────────────────

async function deleteFile(req, res) {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });
    if (!key.startsWith(PREFIX)) {
        return res.status(403).json({ error: 'Cannot delete objects outside the payroll prefix' });
    }

    try {
        await deleteObject(key);
        await audit({ action: 'FILE_DELETED', req, subject: key });
        return res.json({ success: true });
    } catch (err) {
        console.error('[Folder] deleteFile:', err.message);
        return res.status(500).json({ error: 'Failed to delete file' });
    }
}

// ─── POST /api/folders/upload — upload a file into a shared folder ─────────────
// Uses uploadPayrollDoc middleware (applied at router level) to validate the PDF.

async function uploadToFolder(req, res) {
    const { folderName } = req.payrollFormFields || req.body || {};
    if (!folderName) return res.status(400).json({ error: 'folderName is required' });

    const { buffer, originalFileName, mimeType } = req.payrollUpload;

    try {
        const key = buildSharedFileKey(folderName, originalFileName);

        await uploadObject(key, buffer, mimeType, {
            uploadedBy: req.user.userId,
            originalName: originalFileName,
        });

        await audit({ action: 'FILE_UPLOADED', req, subject: key });
        return res.status(201).json({ key });
    } catch (err) {
        console.error('[Folder] upload:', err.message);
        return res.status(500).json({ error: 'Failed to upload file' });
    }
}

// ─── GET /api/folders/view?key= — return a short-lived presigned URL ──────────

async function viewFile(req, res) {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'key is required' });

    // Prevent accessing objects outside the payroll prefix
    if (!key.startsWith(PREFIX)) {
        return res.status(403).json({ error: 'Key is outside the payroll prefix' });
    }

    try {
        const exists = await objectExists(key);
        if (!exists) return res.status(404).json({ error: 'File not found' });

        const url = await presignedGetUrl(key, 'inline'); // inline → opens in browser
        return res.json({ url });
    } catch (err) {
        console.error('[Folder] view:', err.message);
        return res.status(500).json({ error: 'Failed to generate view URL' });
    }
}

module.exports = { listFolder, createFolder, deleteFolder, renameFile, deleteFile, uploadToFolder, viewFile };
