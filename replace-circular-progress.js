// Script to replace all CircularProgress instances with SkeletonBox
const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend', 'src');

// Files to process
const files = [
    'pages/AdminLeavesPage.jsx',
    'components/ViewAnalyticsModal.jsx',
    'pages/ExcelViewerPage.jsx',
    'pages/App.jsx',
    'components/AnalyticsDashboard.jsx',
    'components/EnhancedLeaveRequestModal.jsx',
    'pages/EmployeesPage.jsx',
    'components/ProbationTracker.jsx',
    'pages/NewActivityLogPage.jsx',
    'context/AuthContext.jsx',
    'pages/EmployeeMusterRollPage.jsx',
    'components/AdminEmployeeProfileDialog.jsx',
    'pages/ProfilePage.jsx',
    'pages/LoginPage.jsx',
    'components/EmployeeAnalyticsModalFull.jsx',
    'components/EmployeeAnalyticsModal.jsx',
    'components/EmployeeAttendanceTrendChart.jsx',
    'pages/LeavesTrackerPage.jsx',
    'components/LogDetailModal.jsx',
    'components/UserLogModal.jsx',
    'pages/AdminAttendanceSummaryPage.jsx',
    'pages/AttendanceSummaryPage.jsx',
    'components/EmployeeListModal.jsx',
    'components/AdminLeaveForm.jsx',
    'components/AutoBreakModal.jsx',
    'context/SSOAuthContext.jsx',
    'components/EmployeeAnalyticsModalMinimal.jsx',
    'components/EmployeeForm.jsx',
    'components/ExtraBreakActionButton.jsx',
    'components/EnhancedButton.jsx',
    'components/EmployeeAnalyticsModalWrapper.jsx',
    'components/HolidayBulkUploadModal.jsx',
    'components/NewNotificationDrawer.jsx',
    'pages/PayrollManagementPage.jsx',
    'pages/ManageSectionPage.jsx',
    'pages/SSOLoginPage.jsx',
    'pages/SSOCallbackPage.jsx',
    'pages/ShiftsPage.jsx',
    'pages/ReportsPage.jsx',
    'components/OfficeLocationManager.jsx',
    'components/ProbationSettingsModal.jsx',
    'components/PerformanceOptimized.jsx',
    'components/ShiftForm.jsx',
    'components/payroll/EmployeeSalaryDetail.jsx',
    'components/YearEndLeaveForm.jsx',
    'components/WeeklyLogTable.jsx'
];

function processFile(filePath) {
    const fullPath = path.join(frontendDir, filePath);
    if (!fs.existsSync(fullPath)) {
        console.log(`File not found: ${fullPath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Remove CircularProgress from imports
    const importRegex = /import\s*{\s*([^}]*?)\s*}\s*from\s*['"]@mui\/material['"]/g;
    content = content.replace(importRegex, (match, imports) => {
        const importList = imports.split(',').map(imp => imp.trim());
        const filteredImports = importList.filter(imp => !imp.includes('CircularProgress'));
        if (filteredImports.length === importList.length) return match;
        modified = true;
        return `import { ${filteredImports.join(', ')} } from '@mui/material'`;
    });

    // Add SkeletonBox import if not present and if we have CircularProgress usage
    if (content.includes('CircularProgress') && !content.includes("SkeletonBox")) {
        const skeletonImport = "import { SkeletonBox } from '../components/SkeletonLoaders';";
        if (content.includes("import")) {
            // Add after the last import
            const lastImportMatch = content.match(/import.*?;\s*$/gm);
            if (lastImportMatch) {
                const lastImport = lastImportMatch[lastImportMatch.length - 1];
                content = content.replace(lastImport, lastImport + '\n' + skeletonImport);
                modified = true;
            }
        }
    }

    // Replace CircularProgress usage with SkeletonBox
    const circularProgressRegex = /<CircularProgress([^>]*)\/>/g;
    content = content.replace(circularProgressRegex, (match, attrs) => {
        modified = true;
        // Extract size attribute
        const sizeMatch = attrs.match(/size=\{?(\d+)}?/);
        const size = sizeMatch ? sizeMatch[1] : '24';
        return `<SkeletonBox width="${size}px" height="${size}px" borderRadius="50%" />`;
    });

    // Replace CircularProgress in startIcon
    const startIconRegex = /startIcon=\{([^}]*?CircularProgress[^}]*?)\}/g;
    content = content.replace(startIconRegex, (match, iconContent) => {
        modified = true;
        const sizeMatch = iconContent.match(/size=\{?(\d+)}?/);
        const size = sizeMatch ? sizeMatch[1] : '16';
        return `startIcon={<SkeletonBox width="${size}px" height="${size}px" borderRadius="50%" />}`;
    });

    if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

console.log('Starting CircularProgress replacement...');

files.forEach(processFile);

console.log('Replacement complete!');