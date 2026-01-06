const mongoose = require('mongoose');
const dateUtils = require('../utils/dateUtils');
const LeavePolicyService = require('../services/LeavePolicyService');
require('dotenv').config();

// MOCK DATA for standalone test
const mockDetails = {
    // We need a valid employee ID from DB for full test, but for Friday/Monday check,
    // the service fetches User to check if exists.
    // We can try to fetch a real user if connection works.
};

const runVerification = async () => {
    try {
        if (process.env.MONGO_URI) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('✅ Connected to MongoDB.');
        } else {
            console.warn('⚠️ No MONGO_URI found. DB tests might fail or be skipped.');
        }
    } catch (e) {
        console.error('❌ DB Connection Failed:', e.message);
    }

    console.log('--- STARTING VERIFICATION ---');
    console.log('1. Testing Date Utils (IST)');

    // Test: Month Boundary in IST
    const utcDate = '2023-10-31T20:00:00Z'; // This is Nov 1st in IST
    const istDateStr = dateUtils.toISTDateString(utcDate);
    console.log(`UTC: ${utcDate} -> IST String: ${istDateStr}`);
    if (istDateStr === '2023-11-01') {
        console.log('✅ Date Utils: Correctly identified Nov 1st in IST.');
    } else {
        console.error('❌ Date Utils: FAILED to normalize to IST.');
    }

    // Test: Friday Check
    const friDate = '2023-10-27'; // A Friday
    if (dateUtils.isISTFriday(friDate)) {
        console.log('✅ Date Utils: Correctly identified Friday.');
    } else {
        console.error('❌ Date Utils: FAILED to identify Friday.');
    }

    console.log('\n2. Testing Policy Service');
    // Note: We cannot fully test DB dependent logic (Limits) without DB connection,
    // but we can test the stateless checks (Friday/Monday block)

    const fri = '2023-11-03';
    const mon = '2023-11-06';

    const resultFri = await LeavePolicyService.validateRequest(
        mockDetails.employeeId,
        [fri],
        'Casual',
        'Full Day'
    );

    console.log('Test Friday Block:', resultFri);
    if (!resultFri.allowed && resultFri.rule === 'FRIDAY_BLOCK') {
        console.log('✅ Policy Service: Successfully BLOCKED Friday leave.');
    } else {
        console.error('❌ Policy Service: FAILED to block Friday leave.');
    }

    const resultMon = await LeavePolicyService.validateRequest(
        mockDetails.employeeId,
        [mon],
        'Casual',
        'Full Day'
    );

    console.log('Test Monday Block:', resultMon);
    if (!resultMon.allowed && resultMon.rule === 'MONDAY_BLOCK') {
        console.log('✅ Policy Service: Successfully BLOCKED Monday leave.');
    } else {
        console.error('❌ Policy Service: FAILED to block Monday leave.');
    }

    console.log('--- VERIFICATION COMPLETE ---');
};

runVerification().catch(console.error);
