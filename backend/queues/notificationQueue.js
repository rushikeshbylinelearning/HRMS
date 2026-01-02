// backend/queues/notificationQueue.js
// BullMQ queue for background notification processing
// Decouples notifications from API response time

let notificationQueue = null;
let queueAvailable = false;

// Helper function to test Redis connection using ioredis (same as BullMQ uses)
const testRedisConnection = async (redisConnection) => {
    let testClient = null;
    try {
        // Try to require ioredis (same package BullMQ uses internally)
        let Redis;
        try {
            Redis = require('ioredis');
        } catch (requireError) {
            // ioredis not installed (BullMQ should have it, but handle gracefully)
            return false;
        }

        // Create a test connection with short timeout and no retries
        testClient = new Redis({
            host: redisConnection.host,
            port: redisConnection.port,
            password: redisConnection.password,
            db: redisConnection.db,
            connectTimeout: 2000, // 2 second timeout
            retryStrategy: () => null, // Don't retry on failure
            maxRetriesPerRequest: null,
            enableReadyCheck: false, // Skip ready check for faster failure
        });

        // Try to ping Redis with a timeout
        const pingPromise = testClient.ping();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout')), 2000);
        });

        await Promise.race([pingPromise, timeoutPromise]);
        
        // Connection succeeded
        await testClient.quit();
        return true;
    } catch (error) {
        // Connection failed - clean up
        if (testClient) {
            try {
                testClient.disconnect();
            } catch (e) {
                // Ignore errors during disconnect
            }
        }
        return false;
    }
};

// Try to initialize BullMQ queue with safe fallback
try {
    const { Queue, Worker } = require('bullmq');
    const NewNotificationService = require('../services/NewNotificationService');

    // Redis connection configuration (reuse from environment)
    const redisConnection = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        maxRetriesPerRequest: null, // BullMQ handles retries
    };

    // Test Redis connection before creating Queue
    // Note: This is async, but we'll handle it in startNotificationWorker
    // For now, create Queue with lazy connection (it won't connect until first use)
    notificationQueue = new Queue('notifications', {
        connection: redisConnection,
        defaultJobOptions: {
            attempts: 3, // Retry failed jobs up to 3 times
            backoff: {
                type: 'exponential',
                delay: 2000, // Start with 2 second delay, exponential backoff
            },
            removeOnComplete: {
                age: 3600, // Keep completed jobs for 1 hour
                count: 1000, // Keep last 1000 completed jobs
            },
            removeOnFail: {
                age: 86400, // Keep failed jobs for 24 hours for debugging
            },
        },
    });

    // Don't set queueAvailable yet - we'll test connection in startNotificationWorker
    console.log('[Queue] Notification queue created (connection will be tested when worker starts)');
} catch (error) {
    // BullMQ not installed or initialization failed - use fallback mode
    console.warn('[Queue] BullMQ not available:', error.message);
    console.warn('[Queue] Notifications will be processed synchronously (fallback mode)');
    queueAvailable = false;
}

// Fallback: Direct notification service (used when queue is unavailable)
let NewNotificationService = null;
if (!queueAvailable) {
    try {
        NewNotificationService = require('../services/NewNotificationService');
    } catch (error) {
        console.error('[Queue] Failed to load NewNotificationService:', error.message);
    }
}

// Queue producer functions - add jobs to the queue
// Safe fallback: If queue unavailable, process notifications synchronously (non-blocking)
const queueNotification = {
    /**
     * Queue a check-in notification
     */
    checkIn: async (userId, userName) => {
        if (queueAvailable && notificationQueue) {
            try {
                await notificationQueue.add('check-in', {
                    type: 'check-in',
                    userId,
                    userName,
                });
                return; // Successfully queued
            } catch (error) {
                console.error('[Queue] Error queuing check-in notification:', error.message);
                // Fall through to synchronous fallback
            }
        }
        // Fallback: Process synchronously (non-blocking - fire and forget)
        if (NewNotificationService) {
            NewNotificationService.notifyCheckIn(userId, userName)
                .catch(err => console.error('[Queue Fallback] Error sending check-in notification:', err.message));
        }
    },

    /**
     * Queue a check-out notification
     */
    checkOut: async (userId, userName) => {
        if (queueAvailable && notificationQueue) {
            try {
                await notificationQueue.add('check-out', {
                    type: 'check-out',
                    userId,
                    userName,
                });
                return;
            } catch (error) {
                console.error('[Queue] Error queuing check-out notification:', error.message);
            }
        }
        if (NewNotificationService) {
            NewNotificationService.notifyCheckOut(userId, userName)
                .catch(err => console.error('[Queue Fallback] Error sending check-out notification:', err.message));
        }
    },

    /**
     * Queue a break start notification
     */
    breakStart: async (userId, userName, breakType) => {
        if (queueAvailable && notificationQueue) {
            try {
                await notificationQueue.add('break-start', {
                    type: 'break-start',
                    userId,
                    userName,
                    breakType,
                });
                return;
            } catch (error) {
                console.error('[Queue] Error queuing break-start notification:', error.message);
            }
        }
        if (NewNotificationService) {
            NewNotificationService.notifyBreakStart(userId, userName, breakType)
                .catch(err => console.error('[Queue Fallback] Error sending break-start notification:', err.message));
        }
    },

    /**
     * Queue a break end notification
     */
    breakEnd: async (userId, userName, breakType) => {
        if (queueAvailable && notificationQueue) {
            try {
                await notificationQueue.add('break-end', {
                    type: 'break-end',
                    userId,
                    userName,
                    breakType,
                });
                return;
            } catch (error) {
                console.error('[Queue] Error queuing break-end notification:', error.message);
            }
        }
        if (NewNotificationService) {
            NewNotificationService.notifyBreakEnd(userId, userName, breakType)
                .catch(err => console.error('[Queue Fallback] Error sending break-end notification:', err.message));
        }
    },

    /**
     * Queue an auto-break start notification
     */
    autoBreakStart: async (userId, userName, reason) => {
        if (queueAvailable && notificationQueue) {
            try {
                await notificationQueue.add('auto-break-start', {
                    type: 'auto-break-start',
                    userId,
                    userName,
                    reason,
                });
                return;
            } catch (error) {
                console.error('[Queue] Error queuing auto-break-start notification:', error.message);
            }
        }
        if (NewNotificationService) {
            NewNotificationService.notifyAutoBreakStart(userId, userName, reason)
                .catch(err => console.error('[Queue Fallback] Error sending auto-break-start notification:', err.message));
        }
    },

    /**
     * Queue an auto-break end notification
     */
    autoBreakEnd: async (userId, userName, duration) => {
        if (queueAvailable && notificationQueue) {
            try {
                await notificationQueue.add('auto-break-end', {
                    type: 'auto-break-end',
                    userId,
                    userName,
                    duration,
                });
                return;
            } catch (error) {
                console.error('[Queue] Error queuing auto-break-end notification:', error.message);
            }
        }
        if (NewNotificationService) {
            NewNotificationService.notifyAutoBreakEnd(userId, userName, duration)
                .catch(err => console.error('[Queue Fallback] Error sending auto-break-end notification:', err.message));
        }
    },

    /**
     * Queue a custom notification
     */
    custom: async (notificationData) => {
        if (queueAvailable && notificationQueue) {
            try {
                await notificationQueue.add('custom', {
                    type: 'custom',
                    ...notificationData,
                });
                return;
            } catch (error) {
                console.error('[Queue] Error queuing custom notification:', error.message);
            }
        }
        if (NewNotificationService) {
            NewNotificationService.createAndEmitNotification({
                message: notificationData.message,
                type: notificationData.notificationType || 'info',
                userId: notificationData.userId,
                userName: notificationData.userName,
                recipientType: notificationData.recipientType || 'user',
                category: notificationData.category || 'general',
                priority: notificationData.priority || 'medium',
            }).catch(err => console.error('[Queue Fallback] Error sending custom notification:', err.message));
        }
    },
};

// Worker/Consumer - processes jobs from the queue
// This should be started separately or in the main server file
let notificationWorker = null;
let workerConnectionFailed = false; // Track if worker connection has failed

const startNotificationWorker = async () => {
    // If worker connection previously failed, don't retry
    if (workerConnectionFailed) {
        console.warn('[Queue Worker] Redis connection previously failed, worker not started (using fallback mode)');
        return null;
    }

    // Only create worker if queue exists
    if (!notificationQueue) {
        console.warn('[Queue Worker] Queue not available, worker not started (using fallback mode)');
        queueAvailable = false;
        return null;
    }

    // Only create worker if not already created
    if (notificationWorker) {
        return notificationWorker;
    }

    try {
        const { Worker } = require('bullmq');
        const NewNotificationService = require('../services/NewNotificationService');

        const redisConnection = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB || '0', 10),
            maxRetriesPerRequest: null,
        };

        // Test Redis connection before creating Worker
        const redisAvailable = await testRedisConnection(redisConnection);
        if (!redisAvailable) {
            console.warn('[Queue Worker] Redis not available, worker not started (using fallback mode)');
            console.warn('[Queue Worker] Notifications will be processed synchronously');
            queueAvailable = false;
            workerConnectionFailed = true;
            return null;
        }

        // Create Worker with immediate error handling
        // Set up error handler BEFORE creating worker to catch connection errors immediately
        let workerErrorHandler = null;
        
        try {
            notificationWorker = new Worker(
                'notifications',
                async (job) => {
                    const { type, ...data } = job.data;

                    try {
                        switch (type) {
                            case 'check-in':
                                await NewNotificationService.notifyCheckIn(data.userId, data.userName);
                                break;

                            case 'check-out':
                                await NewNotificationService.notifyCheckOut(data.userId, data.userName);
                                break;

                            case 'break-start':
                                await NewNotificationService.notifyBreakStart(data.userId, data.userName, data.breakType);
                                break;

                            case 'break-end':
                                await NewNotificationService.notifyBreakEnd(data.userId, data.userName, data.breakType);
                                break;

                            case 'auto-break-start':
                                await NewNotificationService.notifyAutoBreakStart(data.userId, data.userName, data.reason);
                                break;

                            case 'auto-break-end':
                                await NewNotificationService.notifyAutoBreakEnd(data.userId, data.userName, data.duration);
                                break;

                            case 'custom':
                                // Handle custom notification data
                                if (data.message) {
                                    await NewNotificationService.createAndEmitNotification({
                                        message: data.message,
                                        type: data.notificationType || 'info',
                                        userId: data.userId,
                                        userName: data.userName,
                                        recipientType: data.recipientType || 'user',
                                        category: data.category || 'general',
                                        priority: data.priority || 'medium',
                                    });
                                }
                                break;

                            default:
                                console.warn(`[Queue Worker] Unknown notification type: ${type}`);
                        }
                    } catch (error) {
                        // Log error and re-throw to trigger retry mechanism
                        console.error(`[Queue Worker] Error processing ${type} notification:`, error.message);
                        throw error;
                    }
                },
                {
                    connection: {
                        ...redisConnection,
                        // Disable retries completely - if connection fails, we'll use fallback
                        retryStrategy: () => {
                            // Return null to stop all retries immediately
                            return null;
                        },
                    },
                    concurrency: 5, // Process up to 5 jobs concurrently
                    limiter: {
                        max: 100, // Max 100 jobs
                        duration: 1000, // Per second
                    },
                }
            );

            // Set up error handler immediately after Worker creation
            // This will catch connection errors as soon as they occur
            workerErrorHandler = (err) => {
                // Check if it's a connection error
                const isConnectionError = err.code === 'ECONNREFUSED' || 
                                        err.message?.includes('ECONNREFUSED') ||
                                        err.message?.includes('connect') ||
                                        err.code === 'ENOTFOUND' ||
                                        err.code === 'ETIMEDOUT';
                
                if (isConnectionError) {
                    // Only log once
                    if (!workerConnectionFailed) {
                        console.warn('[Queue Worker] Redis connection failed, disabling worker (using fallback mode)');
                        console.warn('[Queue Worker] Notifications will be processed synchronously');
                        workerConnectionFailed = true;
                        queueAvailable = false;
                        
                        // Close the worker to stop retries
                        if (notificationWorker) {
                            notificationWorker.close().catch(() => {
                                // Ignore errors during close
                            });
                            notificationWorker = null;
                        }
                    }
                    // Don't log connection errors repeatedly
                    return;
                }
                // Log other errors normally
                console.error('[Queue Worker] Worker error:', err.message);
            };

            notificationWorker.on('error', workerErrorHandler);

            // Event handlers for monitoring
            notificationWorker.on('completed', (job) => {
                console.log(`[Queue Worker] Notification job ${job.id} completed: ${job.data.type}`);
            });

            notificationWorker.on('failed', (job, err) => {
                console.error(`[Queue Worker] Notification job ${job.id} failed: ${err.message}`);
            });

            // Wait a short time to see if connection succeeds
            // If connection fails, the error handler will catch it
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if worker was closed due to connection error
            if (workerConnectionFailed || !notificationWorker) {
                return null;
            }

        } catch (error) {
            // Catch any synchronous errors during Worker creation
            const isConnectionError = error.code === 'ECONNREFUSED' || 
                                    error.message?.includes('ECONNREFUSED') ||
                                    error.message?.includes('connect');
            
            if (isConnectionError) {
                console.warn('[Queue Worker] Redis connection failed during worker creation (using fallback mode)');
                console.warn('[Queue Worker] Notifications will be processed synchronously');
                workerConnectionFailed = true;
                queueAvailable = false;
                notificationWorker = null;
                return null;
            }
            // Re-throw non-connection errors
            throw error;
        }

        queueAvailable = true;
        console.log('[Queue Worker] Notification worker started successfully');
        return notificationWorker;
    } catch (error) {
        console.error('[Queue Worker] Failed to start worker:', error.message);
        console.warn('[Queue Worker] Notifications will be processed synchronously (fallback mode)');
        queueAvailable = false;
        workerConnectionFailed = true;
        return null;
    }
};

// Graceful shutdown
const closeNotificationQueue = async () => {
    if (notificationWorker) {
        await notificationWorker.close();
        notificationWorker = null;
    }
    if (notificationQueue) {
        await notificationQueue.close();
    }
};

process.on('SIGINT', async () => {
    await closeNotificationQueue();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeNotificationQueue();
    process.exit(0);
});

module.exports = {
    queueNotification,
    startNotificationWorker,
    closeNotificationQueue,
    notificationQueue, // Export for monitoring/admin purposes
};

