'use strict';
// db.js — MongoDB connection for salary-service
// Same pattern as AMS db.js: singleton, no manual reconnect, driver handles it.

const mongoose = require('mongoose');

let isConnected = false;

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  [salary-service] MongoDB disconnected. Driver will reconnect automatically.');
    isConnected = false;
});
mongoose.connection.on('reconnected', () => {
    console.log('✅ [salary-service] MongoDB reconnected.');
    isConnected = true;
});
mongoose.connection.on('error', (err) => {
    console.error('❌ [salary-service] MongoDB error:', err.message);
    isConnected = false;
});

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not set');

    console.log('🔗 [salary-service] Connecting to MongoDB...');

    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30_000,
        connectTimeoutMS:         20_000,
        socketTimeoutMS:          60_000,
        maxPoolSize:              10,
        minPoolSize:               2,
        heartbeatFrequencyMS:    15_000,
    });

    await new Promise((resolve, reject) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', reject);
        setTimeout(() => reject(new Error('MongoDB connection timeout')), 25_000);
    });

    isConnected = true;
    console.log('✅ [salary-service] MongoDB connected. Database:', mongoose.connection.name);
    return mongoose.connection;
};

module.exports = connectDB;
