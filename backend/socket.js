// backend/socket.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const jwtUtils = require('./utils/jwtUtils');
const User = require('./models/User');
const NewNotificationService = require('./services/NewNotificationService');
const { setIO } = require('./socketManager');
const SSOVerification = require('./utils/ssoVerification');

const init = (httpServer) => {
    // --- START OF FIX ---
    // Simplified and corrected CORS configuration for robust handshake handling.
    const io = new Server(httpServer, {
        path: '/api/socket.io/',
        cors: {
            origin: [
                "https://attendance.bylinelms.com",
                process.env.FRONTEND_URL,
                // Development origins
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5175", // SSO frontend
                "http://127.0.0.1:5175"
            ].filter(Boolean),
            methods: ["GET", "POST"],
            credentials: true,
        },
        transports: ['websocket', 'polling'], // Prioritize WebSocket
        allowEIO3: true,
    });
    // --- END OF FIX ---

    // Set the global io instance in the manager
    setIO(io);

    // Debug connection events
    io.on('connection', (socket) => {
        console.log('✅ Socket connected:', socket.id);
        
        socket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', socket.id, 'Reason:', reason);
        });
        
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });

    // Debug engine events
    io.engine.on('connection_error', (err) => {
        console.error('Socket.io connection error:', {
            code: err.code,
            message: err.message,
            context: err.context
        });
    });

    // Enhanced Authentication Middleware - supports both AMS JWT and SSO tokens
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            console.log('🔍 Socket auth token:', token ? token.substring(0, 20) + '...' : 'null');
            
            if (!token) {
                console.log('❌ No token provided in socket handshake');
                return next(new Error('Authentication error: No token provided'));
            }

            let decoded = null;
            let user = null;

            // First, try to decode the token header to determine the algorithm
            let tokenHeader;
            try {
                const decoded = jwt.decode(token, { complete: true });
                if (!decoded || !decoded.header) {
                    console.log('❌ Invalid token format: missing header');
                    return next(new Error('Authentication error: Invalid token format - missing header'));
                }
                tokenHeader = decoded.header;
                
                // Validate kid is present
                if (!tokenHeader.kid) {
                    console.log('❌ Missing kid in token header');
                    return next(new Error('Authentication error: Missing key ID (kid) in token header'));
                }
                
                console.log('[SocketAuth] Token header - kid:', tokenHeader.kid, 'alg:', tokenHeader.alg);
            } catch (e) {
                console.log('❌ Could not decode token header:', e.message);
                return next(new Error('Authentication error: Invalid token format'));
            }

            // Verify JWT token using RS256 only
            if (tokenHeader?.alg === 'RS256') {
                try {
                    const kid = tokenHeader.kid;
                    if (!kid) {
                        console.log('❌ kid is not defined in token header');
                        return next(new Error('Authentication error: Missing key ID (kid)'));
                    }
                    
                    console.log('[SocketAuth] Using key:', kid);
                    console.log('🔍 Attempting JWT verification (RS256), kid:', kid);
                    
                    // Determine token type based on kid
                    if (kid.startsWith('sso-key-')) {
                        // SSO token - verify using JWKS
                        console.log('🔍 Detected SSO token, verifying with JWKS...');
                        decoded = await jwtUtils.verifySSOTokenWithJWKS(token);
                        console.log('✅ SSO token verified via JWKS');
                        
                        const userId = decoded.userId || decoded.sub;
                        if (!userId) {
                            throw new Error('No user ID in SSO token');
                        }
                        
                        // Find user by email from SSO token
                        const userEmail = decoded.email;
                        if (!userEmail) {
                            throw new Error('No email in SSO token');
                        }
                        
                        // Ensure MongoDB connection before query
                        const mongoose = require('mongoose');
                        if (mongoose.connection.readyState !== 1) {
                            throw new Error('MongoDB not connected - cannot query user');
                        }
                        
                        user = await User.findOne({ email: userEmail }).lean();
                        if (!user) {
                            throw new Error('User not found for SSO token email: ' + userEmail);
                        }
                    } else {
                        // AMS local token - verify using local public key
                        console.log('[SocketAuth] Detected AMS local token (kid: ' + kid + '), verifying with local key...');
                        decoded = jwtUtils.verify(token);
                        console.log('[SocketAuth] ✅ AMS local token verified');
                        
                        const userId = decoded.userId || decoded.id;
                        if (!userId) {
                            throw new Error('No user ID in AMS token');
                        }
                        
                        // Ensure MongoDB connection before query
                        const mongoose = require('mongoose');
                        if (mongoose.connection.readyState !== 1) {
                            throw new Error('MongoDB not connected - cannot query user');
                        }
                        
                        user = await User.findById(userId).lean();
                        if (!user) {
                            throw new Error('User not found for AMS token');
                        }
                    }
                } catch (err) {
                    console.log('[SocketAuth] ❌ JWT verification failed:', err.message);
                    const kid = tokenHeader?.kid;
                    const tokenType = kid && kid.startsWith('sso-key-') ? 'SSO' : 'AMS';
                    console.log('[SocketAuth] Token type attempted:', tokenType);
                    return next(new Error('Authentication error: Invalid token - ' + err.message));
                }
            } else {
                console.log('[SocketAuth] ❌ Unsupported token algorithm:', tokenHeader?.alg);
                return next(new Error('Authentication error: Unsupported token algorithm - only RS256 is supported'));
            }


            if (!user) {
                console.log('❌ No valid authentication method succeeded');
                return next(new Error('Authentication error: Invalid token or user not found'));
            }

            // Set socket user data
            socket.userId = user._id.toString();
            socket.userRole = user.role;
            socket.fullName = user.fullName;
            socket.userEmail = user.email;
            
            console.log('✅ Socket authenticated for user:', user.email, 'Role:', user.role);
            next();
        } catch (err) {
            console.error('❌ Socket authentication error:', err.message);
            next(new Error('Authentication error: Invalid token or server issue.'));
        }
    });

    // Connection Handler
    io.on('connection', (socket) => {
        // Join a personal room for targeted notifications
        socket.join(`user_${socket.userId}`);
        
        // Admins also join a general admin room for broadcasts
        if (['Admin', 'HR'].includes(socket.userRole)) {
            socket.join('admin_room');
        }

        // Join announcements channel
        socket.join('announcements');
        console.log(`✅ User ${socket.userEmail} joined announcements channel`);

        // Handle announcement messages
        socket.on('sendAnnouncement', (data) => {
            console.log(`📢 Broadcasting announcement from ${socket.userEmail}`);
            // Broadcast to all users EXCEPT the sender
            socket.to('announcements').emit('receiveAnnouncement', data);
        });

        // Handle announcement updates
        socket.on('updateAnnouncement', (data) => {
            console.log(`✏️ Broadcasting announcement update from ${socket.userEmail}`);
            // Broadcast to all users including sender for updates
            io.to('announcements').emit('announcementUpdated', data);
        });

        // Handle announcement deletions
        socket.on('deleteAnnouncement', (data) => {
            console.log(`🗑️ Broadcasting announcement deletion from ${socket.userEmail}`);
            // Broadcast to all users including sender for deletions
            io.to('announcements').emit('announcementDeleted', data);
        });

        // Handle announcement pin/unpin
        socket.on('pinAnnouncement', (data) => {
            console.log(`📌 Broadcasting announcement pin/unpin from ${socket.userEmail}`);
            // Broadcast to all users including sender
            io.to('announcements').emit('announcementPinned', data);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            // Silent disconnect handling
        });
    });
    return io;
};

module.exports = { init };