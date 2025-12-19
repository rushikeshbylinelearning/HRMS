// frontend/src/socket.js
import { io } from 'socket.io-client';

// --- Socket.IO URL Configuration ---
// Use the environment variable or default to same origin
// If frontend and backend are on same domain, using window.location.origin is correct
const getSocketURL = () => {
    if (import.meta.env.DEV) {
        return 'http://localhost:3001'; // Use local backend in development
    }
    
    // If VITE_SOCKET_URL is explicitly set, use it
    if (import.meta.env.VITE_SOCKET_URL) {
        return import.meta.env.VITE_SOCKET_URL;
    }
    
    // For same-domain deployments, use window.location.origin
    // This ensures Socket.IO connects to the same domain as the frontend
    if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        console.log('[Socket] Using current origin:', origin);
        return origin;
    }
    
    return 'https://attendance.bylinelms.com'; // Fallback
};

const URL = getSocketURL();
console.log('[Socket] Initializing with URL:', URL);

        
// Socket.io client with token-based authentication
// A2 Hosting Optimized Configuration
// Token is passed via auth field, not query parameter
// Polling transport is prioritized for A2 Hosting compatibility
const socket = io(URL, {
    autoConnect: false, // Don't connect immediately; AuthContext will manage this after token validation
    path: '/api/socket.io',  // Match backend socket path
    // A2 Hosting: Polling first for better compatibility with shared hosting
    // WebSocket will be attempted as an upgrade if available
    transports: ['polling', 'websocket'], // Polling first (A2 Hosting compatible), websocket as upgrade
    timeout: 30000, // 30 seconds timeout (A2 Hosting optimized)
    reconnection: true,
    reconnectionAttempts: 10, // More attempts for A2 Hosting stability
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000, // Increased max delay for A2 Hosting
    // A2 Hosting: Allow transport upgrades but don't force
    forceNew: false, // Don't force new connection, reuse if possible
    upgrade: true, // Allow upgrade from polling to websocket if available
    rememberUpgrade: false, // Don't remember failed upgrades (A2 Hosting may have intermittent WebSocket issues)
    // Enable credentials for cross-origin requests
    withCredentials: true,
    closeOnBeforeunload: false, // Don't close on page unload
    // A2 Hosting: Additional stability options
    randomizationFactor: 0.5, // Reconnection randomization for A2 Hosting
    // Auth callback - will be set when connecting with token
    // This will be dynamically configured in AuthContext when token is available
});

// Track WebSocket upgrade failures
let websocketUpgradeFailed = false;
let pollingConnected = false;

// Add error handlers for better debugging
socket.on('connect_error', (error) => {
    // Check if this is a WebSocket upgrade error (not a critical polling error)
    const isWebSocketError = error.message.includes('websocket') || 
                             error.message.includes('WebSocket') ||
                             error.type === 'TransportError' ||
                             (error.context && error.context.type === 'websocket');
    
    if (isWebSocketError && pollingConnected) {
        // WebSocket upgrade failed but polling is working - this is not critical
        websocketUpgradeFailed = true;
        console.warn('[Socket] ⚠️ WebSocket upgrade failed (polling transport is working)');
        console.warn('[Socket] The application will continue using polling transport');
        // Prevent further WebSocket upgrade attempts if it consistently fails
        if (socket.io && socket.io.engine) {
            socket.io.engine.upgrade = false; // Disable upgrade attempts
        }
        return; // Don't log as error since polling works
    }
    
    // For non-WebSocket errors or if polling isn't working, log as error
    console.error('[Socket] Connection error:', error.message);
    console.error('[Socket] Error details:', {
        message: error.message,
        description: error.description,
        context: error.context,
        type: error.type,
        url: URL
    });
    
    if (error.message.includes('xhr poll error') || error.message.includes('404')) {
        console.error('[Socket] ❌ 404 Error - Socket.IO path may be incorrect or server not running');
        console.error('[Socket] Attempted URL:', URL);
        console.error('[Socket] Socket path:', '/api/socket.io');
    }
});

socket.on('connect', () => {
    const transport = socket.io?.engine?.transport?.name || 'unknown';
    pollingConnected = (transport === 'polling');
    console.log('[Socket] ✅ Connected successfully');
    console.log('[Socket] Transport:', transport);
    
    // If using polling and WebSocket upgrade previously failed, log info
    if (pollingConnected && websocketUpgradeFailed) {
        console.log('[Socket] ℹ️ Using polling transport (WebSocket not available)');
    }
    
    // Set up engine event listeners after connection is established
    if (socket.io && socket.io.engine) {
        // Monitor transport upgrades
        socket.io.engine.on('upgrade', () => {
            console.log('[Socket] 🔄 Attempting WebSocket upgrade...');
        });

        socket.io.engine.on('upgradeError', (error) => {
            websocketUpgradeFailed = true;
            console.warn('[Socket] ⚠️ WebSocket upgrade failed, continuing with polling');
            console.warn('[Socket] This is normal if WebSocket is not configured on the server');
            // Note: We can't disable upgrades after they fail, but polling will continue to work
        });
    }
});

socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    
    // If disconnected due to server timeout or transport close, attempt reconnection
    // These reasons indicate the connection was closed due to inactivity
    const shouldReconnect = reason === 'transport close' || 
                            reason === 'ping timeout' || 
                            reason === 'server namespace disconnect';
    
    if (shouldReconnect && socket.auth?.token) {
        console.log('[Socket] Connection lost due to idle timeout, will reconnect...');
        // Socket.IO will automatically attempt reconnection based on configuration
        // But we should update the token in case it was refreshed
        const currentToken = sessionStorage.getItem('token') || sessionStorage.getItem('ams_token');
        if (currentToken && currentToken !== socket.auth.token) {
            console.log('[Socket] Token updated, reconnecting with new token...');
            socket.auth.token = currentToken;
        }
    }
});

// Handle reconnection events
socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] ✅ Reconnected after', attemptNumber, 'attempt(s)');
    pollingConnected = false; // Reset to check transport on reconnect
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('[Socket] 🔄 Reconnection attempt', attemptNumber);
    // Update token in case it was refreshed during disconnection
    const currentToken = sessionStorage.getItem('token') || sessionStorage.getItem('ams_token');
    if (currentToken) {
        socket.auth = { token: currentToken };
    }
});

socket.on('reconnect_error', (error) => {
    console.error('[Socket] Reconnection error:', error.message);
});

socket.on('reconnect_failed', () => {
    console.error('[Socket] ❌ Reconnection failed after all attempts');
    console.log('[Socket] Will attempt to reconnect when page becomes visible or on next connection attempt');
});

// Helper function to connect socket with token
export const connectSocketWithToken = (token) => {
    if (!token) {
        console.error('[Socket] Cannot connect: No token provided');
        return;
    }
    
    console.log('[Socket] Connecting with token...');
    console.log('[Socket] Connection URL:', URL);
    console.log('[Socket] Socket path:', '/api/socket.io');
    console.log('[Socket] Environment:', import.meta.env.DEV ? 'development' : 'production');
    
    // Disconnect existing connection if any
    if (socket.connected) {
        console.log('[Socket] Disconnecting existing connection...');
        socket.disconnect();
    }
    
    // Set auth token before connecting
    socket.auth = { token };
    
    // Connect
    socket.connect();
    
    console.log('[Socket] Socket connection initiated with token');
    
    // Add timeout to check connection status
    setTimeout(() => {
        if (!socket.connected) {
            console.warn('[Socket] ⚠️ Socket not connected after 5 seconds');
            console.warn('[Socket] Connection state:', {
                connected: socket.connected,
                disconnected: socket.disconnected,
                id: socket.id
            });
        } else {
            console.log('[Socket] ✅ Socket connected successfully');
        }
    }, 5000);
};

export default socket;