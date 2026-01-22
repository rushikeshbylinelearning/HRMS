// backend/scripts/sync-all-leaves.js
/**
 * Convenience script to sync all approved leaves for both November and December 2025.
 * This runs the sync script for both months sequentially.
 * 
 * Usage: node scripts/sync-all-leaves.js
 */

const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'sync-existing-leaves.js');

console.log('🔄 Syncing all approved leaves for November and December 2025...\n');

// Sync November
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📅 NOVEMBER 2025');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
try {
    execSync(`node "${scriptPath}" 2025-11-01 2025-11-30`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log('\n✅ November leaves sync completed!\n');
} catch (error) {
    console.error('\n❌ Error syncing November leaves:', error.message);
    console.log('Continuing with December...\n');
}

// Sync December
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📅 DECEMBER 2025');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
try {
    execSync(`node "${scriptPath}" 2025-12-01 2025-12-31`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log('\n✅ December leaves sync completed!\n');
} catch (error) {
    console.error('\n❌ Error syncing December leaves:', error.message);
    process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All leaves sync completed successfully!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');




