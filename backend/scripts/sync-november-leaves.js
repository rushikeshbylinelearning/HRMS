// backend/scripts/sync-november-leaves.js
/**
 * Convenience script to sync all approved leaves for November 2025.
 * This is a wrapper around sync-existing-leaves.js for November month.
 * 
 * Usage: node scripts/sync-november-leaves.js
 */

const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'sync-existing-leaves.js');
const startDate = '2025-11-01';
const endDate = '2025-11-30';

console.log('🔄 Syncing approved leaves for November 2025...');
console.log(`   Date range: ${startDate} to ${endDate}\n`);

try {
    execSync(`node "${scriptPath}" ${startDate} ${endDate}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log('\n✅ November leaves sync completed!');
} catch (error) {
    console.error('\n❌ Error syncing November leaves:', error.message);
    process.exit(1);
}




