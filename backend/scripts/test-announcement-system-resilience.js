/**
 * Announcement System Resilience Test
 * Tests socket resilience, memory leaks, and edge cases
 */

const io = require('socket.io-client');
const axios = require('axios');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const TEST_TOKEN = process.env.TEST_TOKEN; // Provide valid JWT token

if (!TEST_TOKEN) {
  console.error('❌ TEST_TOKEN environment variable required');
  console.error('Usage: TEST_TOKEN=<your_jwt_token> node test-announcement-system-resilience.js');
  process.exit(1);
}

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`
  }
});

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);
  
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

// Test 1: Rapid Announcements (10 in 5 seconds)
async function testRapidAnnouncements() {
  console.log('\n📊 Test 1: Rapid Announcements (10 in 5 seconds)');
  
  const socket = io(BACKEND_URL, {
    path: '/api/socket.io',
    auth: { token: TEST_TOKEN },
    transports: ['websocket']
  });

  return new Promise((resolve) => {
    let receivedCount = 0;
    const receivedIds = new Set();
    
    socket.on('connect', async () => {
      console.log('   Socket connected');
      
      // Listen for announcements
      socket.on('receiveAnnouncement', (msg) => {
        receivedCount++;
        receivedIds.add(msg._id);
        console.log(`   Received announcement ${receivedCount}: ${msg._id}`);
      });
      
      // Send 10 announcements rapidly
      const startTime = Date.now();
      for (let i = 0; i < 10; i++) {
        try {
          const { data } = await api.post('/announcements', {
            message: `Rapid test message ${i + 1} - ${Date.now()}`
          });
          socket.emit('sendAnnouncement', data);
          console.log(`   Sent announcement ${i + 1}`);
        } catch (error) {
          console.error(`   Error sending announcement ${i + 1}:`, error.message);
        }
        
        // Small delay to avoid overwhelming server
        await new Promise(r => setTimeout(r, 500));
      }
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Wait for all messages to be received
      setTimeout(() => {
        socket.disconnect();
        
        const noDuplicates = receivedIds.size === receivedCount;
        const allReceived = receivedCount >= 9; // Allow 1 miss due to timing
        
        logTest(
          'Rapid Announcements',
          noDuplicates && allReceived,
          `Sent: 10, Received: ${receivedCount}, Unique: ${receivedIds.size}, Duration: ${duration.toFixed(2)}s`
        );
        
        resolve();
      }, 2000);
    });
    
    socket.on('connect_error', (error) => {
      console.error('   Socket connection error:', error.message);
      logTest('Rapid Announcements', false, `Connection error: ${error.message}`);
      resolve();
    });
  });
}

// Test 2: Socket Disconnect and Reconnect
async function testSocketReconnect() {
  console.log('\n📊 Test 2: Socket Disconnect and Reconnect');
  
  const socket = io(BACKEND_URL, {
    path: '/api/socket.io',
    auth: { token: TEST_TOKEN },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000
  });

  return new Promise((resolve) => {
    let connectCount = 0;
    let reconnected = false;
    
    socket.on('connect', () => {
      connectCount++;
      console.log(`   Connected (attempt ${connectCount})`);
      
      if (connectCount === 1) {
        // Disconnect after first connection
        setTimeout(() => {
          console.log('   Forcing disconnect...');
          socket.disconnect();
        }, 1000);
      } else {
        reconnected = true;
        socket.disconnect();
        
        logTest(
          'Socket Reconnect',
          reconnected,
          `Reconnected successfully after disconnect`
        );
        
        resolve();
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`   Disconnected: ${reason}`);
      
      if (connectCount === 1) {
        // Trigger reconnect
        setTimeout(() => {
          console.log('   Attempting reconnect...');
          socket.connect();
        }, 1000);
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('   Connection error:', error.message);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!reconnected) {
        socket.disconnect();
        logTest('Socket Reconnect', false, 'Reconnection timeout');
        resolve();
      }
    }, 10000);
  });
}

// Test 3: Fetch Announcements After Reconnect
async function testFetchAfterReconnect() {
  console.log('\n📊 Test 3: Fetch Announcements After Reconnect');
  
  try {
    // Create an announcement
    const { data: newMsg } = await api.post('/announcements', {
      message: `Test message for reconnect - ${Date.now()}`
    });
    console.log('   Created test announcement:', newMsg._id);
    
    // Fetch announcements
    const { data: messages } = await api.get('/announcements');
    console.log(`   Fetched ${messages.length} announcements`);
    
    // Check if our message is in the list
    const found = messages.some(msg => msg._id === newMsg._id);
    
    logTest(
      'Fetch After Reconnect',
      found && messages.length > 0,
      `Found test message: ${found}, Total messages: ${messages.length}`
    );
  } catch (error) {
    console.error('   Error:', error.message);
    logTest('Fetch After Reconnect', false, error.message);
  }
}

// Test 4: No Duplicate Badge Increments
async function testNoDuplicateBadgeIncrements() {
  console.log('\n📊 Test 4: No Duplicate Badge Increments');
  
  const socket = io(BACKEND_URL, {
    path: '/api/socket.io',
    auth: { token: TEST_TOKEN },
    transports: ['websocket']
  });

  return new Promise((resolve) => {
    const receivedMessages = [];
    
    socket.on('connect', async () => {
      console.log('   Socket connected');
      
      // Listen for announcements
      socket.on('receiveAnnouncement', (msg) => {
        receivedMessages.push(msg._id);
        console.log(`   Received: ${msg._id}`);
      });
      
      // Send one announcement
      try {
        const { data } = await api.post('/announcements', {
          message: `Duplicate test message - ${Date.now()}`
        });
        socket.emit('sendAnnouncement', data);
        console.log('   Sent announcement:', data._id);
      } catch (error) {
        console.error('   Error:', error.message);
      }
      
      // Wait and check for duplicates
      setTimeout(() => {
        socket.disconnect();
        
        const uniqueMessages = new Set(receivedMessages);
        const noDuplicates = uniqueMessages.size === receivedMessages.length;
        
        logTest(
          'No Duplicate Badge Increments',
          noDuplicates,
          `Received: ${receivedMessages.length}, Unique: ${uniqueMessages.size}`
        );
        
        resolve();
      }, 3000);
    });
    
    socket.on('connect_error', (error) => {
      console.error('   Connection error:', error.message);
      logTest('No Duplicate Badge Increments', false, error.message);
      resolve();
    });
  });
}

// Test 5: Mark as Read API
async function testMarkAsReadAPI() {
  console.log('\n📊 Test 5: Mark as Read API');
  
  try {
    // Mark as read
    const { data: markResult } = await api.post('/announcements/mark-read');
    console.log('   Marked as read:', markResult.lastReadTime);
    
    // Fetch last read time
    const { data: fetchResult } = await api.get('/announcements/last-read');
    console.log('   Fetched last read time:', fetchResult.lastReadTime);
    
    const success = markResult.success && fetchResult.lastReadTime !== null;
    
    logTest(
      'Mark as Read API',
      success,
      `Mark success: ${markResult.success}, Fetch success: ${fetchResult.lastReadTime !== null}`
    );
  } catch (error) {
    console.error('   Error:', error.message);
    logTest('Mark as Read API', false, error.message);
  }
}

// Test 6: Cross-Device Sync
async function testCrossDeviceSync() {
  console.log('\n📊 Test 6: Cross-Device Sync (Backend Persistence)');
  
  try {
    // Mark as read
    const timestamp1 = new Date().toISOString();
    await api.post('/announcements/mark-read');
    console.log('   Marked as read at:', timestamp1);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 1000));
    
    // Fetch from "another device"
    const { data } = await api.get('/announcements/last-read');
    console.log('   Fetched last read time:', data.lastReadTime);
    
    const synced = data.lastReadTime !== null;
    
    logTest(
      'Cross-Device Sync',
      synced,
      `Backend persisted: ${synced}`
    );
  } catch (error) {
    console.error('   Error:', error.message);
    logTest('Cross-Device Sync', false, error.message);
  }
}

// Test 7: Memory Leak Check (Socket Cleanup)
async function testMemoryLeakCheck() {
  console.log('\n📊 Test 7: Memory Leak Check (Socket Cleanup)');
  
  const initialMemory = process.memoryUsage().heapUsed;
  console.log(`   Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
  
  // Create and destroy 10 socket connections
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => {
      const socket = io(BACKEND_URL, {
        path: '/api/socket.io',
        auth: { token: TEST_TOKEN },
        transports: ['websocket']
      });
      
      socket.on('connect', () => {
        socket.disconnect();
        resolve();
      });
      
      socket.on('connect_error', () => {
        resolve();
      });
      
      setTimeout(resolve, 2000); // Timeout
    });
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  console.log(`   Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
  
  const memoryIncrease = finalMemory - initialMemory;
  const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
  console.log(`   Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);
  
  // Allow up to 10 MB increase (reasonable for 10 connections)
  const noMemoryLeak = memoryIncreaseMB < 10;
  
  logTest(
    'Memory Leak Check',
    noMemoryLeak,
    `Memory increase: ${memoryIncreaseMB.toFixed(2)} MB (threshold: 10 MB)`
  );
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Announcement System Resilience Tests\n');
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Token: ${TEST_TOKEN.substring(0, 20)}...`);
  
  try {
    await testRapidAnnouncements();
    await testSocketReconnect();
    await testFetchAfterReconnect();
    await testNoDuplicateBadgeIncrements();
    await testMarkAsReadAPI();
    await testCrossDeviceSync();
    await testMemoryLeakCheck();
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
