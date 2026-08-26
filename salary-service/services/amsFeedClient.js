'use strict';
// services/amsFeedClient.js
//
// Client for the AMS internal payroll feed endpoint.
// salary-service NEVER queries AMS's MongoDB directly.
// All attendance/leave data is fetched via this explicit read-only API.
//
// AMS endpoint (to be added to AMS backend — see ams-internal-routes note below):
//   GET /internal/payroll-feed/:employeeId?month=M&year=YYYY
//
// Authentication: X-Service-Token header (SERVICE_TOKEN env var, shared secret).
// Returns only what payroll math needs — no extra PII.

const https = require('https');
const http  = require('http');
const { URL } = require('url');

/**
 * Fetches attendance and leave data for one employee for a given month.
 *
 * @param {string} employeeId  AMS employee identifier
 * @param {number} month       1–12
 * @param {number} year        e.g. 2026
 * @returns {Promise<object>} attendance summary
 * @throws if AMS returns non-2xx or SERVICE_TOKEN is missing
 */
async function fetchEmployeeAttendance(employeeId, month, year) {
    const baseUrl = process.env.AMS_INTERNAL_BASE_URL;
    if (!baseUrl) {
        throw new Error('AMS_INTERNAL_BASE_URL is not configured');
    }

    const serviceToken = process.env.SERVICE_TOKEN;
    if (!serviceToken) {
        throw new Error('SERVICE_TOKEN is not set — cannot call AMS internal feed');
    }

    const url = new URL(`/internal/payroll-feed/${encodeURIComponent(employeeId)}`, baseUrl);
    url.searchParams.set('month', String(month));
    url.searchParams.set('year',  String(year));

    return new Promise((resolve, reject) => {
        const transport = url.protocol === 'https:' ? https : http;
        const req = transport.get(
            url.toString(),
            {
                headers: {
                    'x-service-token': serviceToken,
                    'accept': 'application/json',
                },
                timeout: 15_000,
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 404) {
                        // Employee not found in AMS — return zeros rather than hard fail
                        return resolve(emptyAttendanceData());
                    }
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error(`AMS feed returned HTTP ${res.statusCode} for employee ${employeeId}`));
                    }
                    try {
                        const parsed = JSON.parse(data);
                        resolve(normalise(parsed));
                    } catch (e) {
                        reject(new Error(`AMS feed returned invalid JSON: ${e.message}`));
                    }
                });
            }
        );
        req.on('error', (e) => reject(new Error(`AMS feed request failed: ${e.message}`)));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('AMS feed request timed out after 15s'));
        });
    });
}

/**
 * Normalises the AMS response into the shape expected by payrollCompute.js.
 * Defensive defaults ensure missing fields are zero, not undefined.
 */
function normalise(amsResponse) {
    const d = amsResponse.data || amsResponse;
    return {
        presentDays:     Number(d.presentDays     || 0),
        paidLeaveDays:   Number(d.paidLeaveDays   || 0),
        unpaidLeaveDays: Number(d.unpaidLeaveDays || 0),
        halfDays:        Number(d.halfDays        || 0),
        lopDays:         Number(d.lopDays         || 0),
        overtimeHours:   Number(d.overtimeHours   || 0),
        workingDays:     Number(d.workingDays     || 26),
    };
}

function emptyAttendanceData() {
    return {
        presentDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0,
        halfDays: 0, lopDays: 0, overtimeHours: 0, workingDays: 26,
    };
}

/**
 * Fetches the list of all employees from AMS.
 *
 * @returns {Promise<Array<object>>} employee list
 * @throws if AMS returns non-2xx or SERVICE_TOKEN is missing
 */
async function fetchEmployeeList() {
    const baseUrl = process.env.AMS_INTERNAL_BASE_URL;
    if (!baseUrl) {
        throw new Error('AMS_INTERNAL_BASE_URL is not configured');
    }

    const serviceToken = process.env.SERVICE_TOKEN;
    if (!serviceToken) {
        throw new Error('SERVICE_TOKEN is not set — cannot call AMS internal feed');
    }

    const url = new URL('/internal/employees', baseUrl);

    return new Promise((resolve, reject) => {
        const transport = url.protocol === 'https:' ? https : http;
        const req = transport.get(
            url.toString(),
            {
                headers: {
                    'x-service-token': serviceToken,
                    'accept': 'application/json',
                },
                timeout: 15_000,
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error(`AMS employee feed returned HTTP ${res.statusCode}`));
                    }
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.data.employees || []);
                    } catch (e) {
                        reject(new Error(`AMS employee feed returned invalid JSON: ${e.message}`));
                    }
                });
            }
        );
        req.on('error', (e) => reject(new Error(`AMS employee feed request failed: ${e.message}`)));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('AMS employee feed request timed out after 15s'));
        });
    });
}

module.exports = { fetchEmployeeAttendance, fetchEmployeeList };
