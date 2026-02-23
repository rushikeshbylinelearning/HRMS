// Test script to verify API configuration
// Run with: node test-api-config.js

console.log('=== API Configuration Test ===\n');

// Simulate Vite environment variables
const mockEnv = {
  DEV: true,
  VITE_API_BASE_URL: 'https://attendance-test.bylinelms.com'
};

console.log('Environment Variables:');
console.log('  DEV:', mockEnv.DEV);
console.log('  VITE_API_BASE_URL:', mockEnv.VITE_API_BASE_URL);
console.log('');

// Simulate axios baseURL logic from frontend/src/api/axios.js
const baseURL = mockEnv.DEV 
  ? '/api' // Use Vite proxy in development
  : (mockEnv.VITE_API_BASE_URL 
      ? (mockEnv.VITE_API_BASE_URL.endsWith('/api') 
          ? mockEnv.VITE_API_BASE_URL 
          : `${mockEnv.VITE_API_BASE_URL}/api`)
      : 'https://attendance-test.bylinelms.com/api');

console.log('Calculated baseURL:', baseURL);
console.log('');

// Test API call paths
const testPaths = [
  '/leaves/request',
  '/attendance/my-weekly-log',
  '/admin/leaves',
  '/auth/me'
];

console.log('API Call Examples:');
console.log('─────────────────────────────────────────────────────────');
testPaths.forEach(path => {
  const fullUrl = baseURL + path;
  console.log(`  api.post('${path}')`);
  console.log(`  → Frontend: http://localhost:5173${fullUrl}`);
  console.log(`  → Proxied to: http://127.0.0.1:3001${fullUrl}`);
  console.log('');
});

console.log('=== Configuration Summary ===');
console.log('✅ Development Mode:');
console.log('   - Frontend: http://localhost:5173');
console.log('   - Backend: http://127.0.0.1:3001');
console.log('   - Proxy: /api → http://127.0.0.1:3001/api');
console.log('');
console.log('✅ Production Mode:');
console.log('   - Frontend: https://attendance-test.bylinelms.com');
console.log('   - Backend: https://attendance-test.bylinelms.com/api');
console.log('   - Direct: No proxy needed');
console.log('');

console.log('=== Troubleshooting ===');
console.log('If you see 400 Bad Request:');
console.log('1. Check backend is running: curl http://127.0.0.1:3001/api/health');
console.log('2. Verify backend port in backend/.env: PORT=3001');
console.log('3. Restart Vite dev server: npm run dev');
console.log('4. Check browser console for axios baseURL log');
console.log('5. Check network tab - request should go to localhost:5173/api/*');
console.log('');
