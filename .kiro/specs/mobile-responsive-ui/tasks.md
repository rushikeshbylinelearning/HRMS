# Tasks: Mobile Responsive UI Implementation

## Phase 1: Critical Shell Fixes (MainLayout, Sidebar, Topbar)

### 1.1 Create Mobile Detection Hook
- [x] 1.1.1 Create `frontend/src/hooks/useMobileDetection.ts` hook
- [x] 1.1.2 Implement viewport width detection with window.matchMedia
- [x] 1.1.3 Add resize event listener with 150ms debounce
- [x] 1.1.4 Return isMobile, isTablet, isDesktop, breakpoint values
- [x] 1.1.5 Add cleanup for event listeners on unmount
- [ ] 1.1.6 Write unit tests for hook

### 1.2 Update MainLayout for Mobile
- [x] 1.2.1 Add mobile menu state (isMobileMenuOpen) to MainLayout.jsx
- [ ] 1.2.2 Integrate useMobileDetection hook
- [x] 1.2.3 Pass mobile menu props to Sidebar and Topbar
- [x] 1.2.4 Add mobile backdrop element with click handler
- [ ] 1.2.5 Implement body scroll lock when menu is open
- [-] 1.2.6 Update MainLayout.css with mobile media queries
  - [x] 1.2.6.1 Add @media (max-width: 768px) for mobile layout
  - [x] 1.2.6.2 Set main-content margin-left: 0 on mobile
  - [x] 1.2.6.3 Set main-content padding: 72px 16px 16px on mobile
  - [x] 1.2.6.4 Add backdrop styles (fixed, full-screen, dark overlay)

### 1.3 Transform Sidebar to Mobile Overlay
- [x] 1.3.1 Update Sidebar.jsx to accept isMobileMenuOpen and onMobileMenuClose props
- [x] 1.3.2 Add conditional rendering for mobile overlay mode
- [x] 1.3.3 Implement slide-in animation (transform: translateX)
- [x] 1.3.4 Add click handler to close menu on navigation
- [-] 1.3.5 Update Sidebar.css with mobile media queries
  - [x] 1.3.5.1 Add @media (max-width: 768px) for mobile sidebar
  - [x] 1.3.5.2 Set position: fixed, left: -280px (hidden by default)
  - [x] 1.3.5.3 Set width: 280px on mobile
  - [x] 1.3.5.4 Add .sidebar--open class with left: 0
  - [x] 1.3.5.5 Add transition: left 300ms ease-out
  - [x] 1.3.5.6 Set z-index: 1100 (above backdrop)

### 1.4 Add Hamburger Menu to Topbar
- [x] 1.4.1 Update Topbar.jsx to accept onMobileMenuToggle prop
- [x] 1.4.2 Add hamburger IconButton (MenuIcon) visible only on mobile
- [x] 1.4.3 Position hamburger on left side of Topbar
- [x] 1.4.4 Add click handler to toggle mobile menu
- [ ] 1.4.5 Update Topbar.css with mobile media queries
  - [ ] 1.4.5.1 Add @media (max-width: 768px) for mobile topbar
  - [ ] 1.4.5.2 Show hamburger button (display: flex)
  - [ ] 1.4.5.3 Adjust logo size for mobile (height: 32px)
  - [ ] 1.4.5.4 Adjust padding for mobile (0 12px)
  - [ ] 1.4.5.5 Ensure hamburger has 44px touch target

## Phase 2: Global Mobile CSS (index.css)

### 2.1 Add Mobile Utility Classes
- [ ] 2.1.1 Add .mobile-only class (display: none on desktop, block on mobile)
- [ ] 2.1.2 Add .desktop-only class (display: block on desktop, none on mobile)
- [ ] 2.1.3 Add .mobile-full-width class (width: 100% on mobile)
- [ ] 2.1.4 Add .mobile-stack class (flex-direction: column on mobile)
- [ ] 2.1.5 Add .mobile-padding-sm class (padding: 12px on mobile)
- [ ] 2.1.6 Add .mobile-padding-md class (padding: 16px on mobile)
- [ ] 2.1.7 Add .mobile-padding-lg class (padding: 24px on mobile)

### 2.2 Add Mobile Touch Target Styles
- [ ] 2.2.1 Add global button min-height: 44px on mobile
- [ ] 2.2.2 Add global link min-height: 44px on mobile
- [ ] 2.2.3 Add global IconButton min-width/height: 44px on mobile
- [ ] 2.2.4 Add tap highlight color (-webkit-tap-highlight-color)
- [ ] 2.2.5 Add touch-action: manipulation for buttons

### 2.3 Add Mobile Typography Overrides
- [ ] 2.3.1 Set body font-size: 16px on mobile (prevent zoom on input focus)
- [ ] 2.3.2 Scale down h1-h6 sizes for mobile
- [ ] 2.3.3 Set line-height: 1.5 for body text
- [ ] 2.3.4 Add word-wrap: break-word for long text

## Phase 3: MUI Theme Override (optimizedTheme.js)

### 3.1 Add Mobile Breakpoints to Theme
- [ ] 3.1.1 Define custom breakpoints in theme (xs, sm, md, lg, xl)
- [ ] 3.1.2 Set xs: 0, sm: 480, md: 768, lg: 1024, xl: 1440

### 3.2 Override MUI Components for Mobile
- [ ] 3.2.1 MuiButton: Set fullWidth: true on mobile, minHeight: 44px
- [ ] 3.2.2 MuiIconButton: Set size: 44px on mobile
- [ ] 3.2.3 MuiTextField: Set fullWidth: true on mobile, minHeight: 44px
- [ ] 3.2.4 MuiDialog: Set fullWidth: true, maxWidth: 'sm' on mobile
- [ ] 3.2.5 MuiDrawer: Set width: 280px on mobile
- [ ] 3.2.6 MuiTable: Add mobile card transform styles
- [ ] 3.2.7 MuiChip: Adjust size for mobile (height: 28px)
- [ ] 3.2.8 MuiCard: Set margin: 16px 0 on mobile

## Phase 4: Individual Page Responsive CSS

### 4.1 AdminDashboardPage Mobile Styles
- [ ] 4.1.1 Update AdminDashboardPage.css with mobile media queries
- [ ] 4.1.2 Transform .top-cards-grid to single column on mobile
- [ ] 4.1.3 Stack .bottom-cards-grid vertically on mobile
- [ ] 4.1.4 Transform .whos-in-item to card layout on mobile
- [ ] 4.1.5 Transform .request-item to card layout on mobile
- [ ] 4.1.6 Transform .activity-item to card layout on mobile
- [ ] 4.1.7 Adjust card padding to 16px on mobile
- [ ] 4.1.8 Set card margin-bottom to 16px on mobile

### 4.2 EmployeesPage Mobile Styles
- [x] 4.2.1 Update EmployeesPage.css with mobile media queries
- [ ] 4.2.2 Hide .employee-grid-header on mobile
- [ ] 4.2.3 Transform .employee-grid-row to card layout on mobile
- [x] 4.2.4 Add data-label attributes to all grid cells
- [ ] 4.2.5 Display column labels inline with data on mobile
- [ ] 4.2.6 Stack action buttons vertically in cards on mobile
- [ ] 4.2.7 Make search bar full-width on mobile
- [ ] 4.2.8 Make "Add Employee" button full-width on mobile
- [ ] 4.2.9 Adjust pagination controls for mobile

### 4.3 AdminLeavesPage Mobile Styles
- [ ] 4.3.1 Update AdminLeavesPage.css with mobile media queries
- [ ] 4.3.2 Transform MUI Table to card layout on mobile
- [ ] 4.3.3 Add data-label attributes to TableCell components
- [ ] 4.3.4 Hide TableHead on mobile
- [ ] 4.3.5 Transform TableRow to card with border and padding
- [ ] 4.3.6 Display column labels inline with data
- [ ] 4.3.7 Stack action buttons vertically in cards
- [ ] 4.3.8 Make filter controls full-width on mobile

### 4.4 AdminAttendanceSummaryPage Mobile Styles
- [ ] 4.4.1 Update AdminAttendanceSummaryPage.css with mobile media queries
- [ ] 4.4.2 Transform attendance grid to card layout on mobile
- [ ] 4.4.3 Stack date filters vertically on mobile
- [ ] 4.4.4 Make date pickers full-width on mobile
- [ ] 4.4.5 Adjust attendance status chips for mobile
- [ ] 4.4.6 Transform employee rows to cards with all data visible

### 4.5 AnalyticsPage Mobile Styles
- [ ] 4.5.1 Update AnalyticsPage.css with mobile media queries
- [ ] 4.5.2 Stack chart containers vertically on mobile
- [ ] 4.5.3 Make charts responsive (width: 100%, height: auto)
- [ ] 4.5.4 Adjust chart legends for mobile (position: bottom)
- [ ] 4.5.5 Stack filter controls vertically on mobile
- [ ] 4.5.6 Reduce chart padding on mobile

### 4.6 ReportsPage Mobile Styles
- [ ] 4.6.1 Update ReportsPage.css with mobile media queries
- [ ] 4.6.2 Stack report cards vertically on mobile
- [ ] 4.6.3 Make report filters full-width on mobile
- [ ] 4.6.4 Adjust report table to card layout on mobile
- [ ] 4.6.5 Make download buttons full-width on mobile

### 4.7 SchedulingManagementPage Mobile Styles
- [ ] 4.7.1 Update SchedulingManagementPage.css with mobile media queries
- [ ] 4.7.2 Transform shift grid to card layout on mobile
- [ ] 4.7.3 Stack shift form fields vertically on mobile
- [ ] 4.7.4 Make time pickers full-width on mobile
- [ ] 4.7.5 Adjust shift cards for mobile (padding, spacing)

### 4.8 ManageSectionPage Mobile Styles
- [ ] 4.8.1 Update ManageSectionPage.css with mobile media queries
- [ ] 4.8.2 Stack section cards vertically on mobile
- [ ] 4.8.3 Make section forms full-width on mobile
- [ ] 4.8.4 Adjust action buttons for mobile (full-width)

### 4.9 ProbationPage Mobile Styles
- [ ] 4.9.1 Update ProbationTracker.css with mobile media queries
- [ ] 4.9.2 Stack probation cards vertically on mobile
- [ ] 4.9.3 Adjust progress bars for mobile (full-width)
- [ ] 4.9.4 Make probation forms full-width on mobile

### 4.10 PayrollManagementPage Mobile Styles
- [ ] 4.10.1 Update payroll CSS files with mobile media queries
- [ ] 4.10.2 Transform payroll table to card layout on mobile
- [ ] 4.10.3 Stack payroll filters vertically on mobile
- [ ] 4.10.4 Make payroll forms full-width on mobile
- [ ] 4.10.5 Adjust currency display for mobile

### 4.11 NewActivityLogPage Mobile Styles
- [ ] 4.11.1 Update ActivityLogsPage.css with mobile media queries
- [ ] 4.11.2 Transform activity log table to card layout on mobile
- [ ] 4.11.3 Stack log filters vertically on mobile
- [ ] 4.11.4 Adjust log detail modal for mobile (full-width)
- [ ] 4.11.5 Make log entries tappable with 44px height

### 4.12 AdminPoliciesPage Mobile Styles
- [ ] 4.12.1 Update AdminPoliciesPage.css with mobile media queries
- [ ] 4.12.2 Stack policy cards vertically on mobile
- [ ] 4.12.3 Make policy upload form full-width on mobile
- [ ] 4.12.4 Adjust PDF viewer for mobile (full-width, scrollable)
- [ ] 4.12.5 Make policy action buttons full-width on mobile

### 4.13 CIFManagement Mobile Styles
- [ ] 4.13.1 Update CIFManagement.css with mobile media queries
- [ ] 4.13.2 Transform CIF table to card layout on mobile
- [ ] 4.13.3 Stack CIF form fields vertically on mobile
- [ ] 4.13.4 Make file upload area full-width on mobile
- [ ] 4.13.5 Adjust CIF detail view for mobile

### 4.14 LoginPage Mobile Styles
- [ ] 4.14.1 Update LoginPage.css with mobile media queries
- [ ] 4.14.2 Center login card on mobile (full-width with margin)
- [ ] 4.14.3 Make login form fields full-width on mobile
- [ ] 4.14.4 Adjust logo size for mobile
- [ ] 4.14.5 Make login button full-width on mobile
- [ ] 4.14.6 Stack SSO buttons vertically on mobile

### 4.15 PageHeroHeader Component Mobile Styles
- [ ] 4.15.1 Update PageHeroHeader.css with mobile media queries
- [ ] 4.15.2 Stack title and actions vertically on mobile
- [ ] 4.15.3 Make action area full-width on mobile
- [ ] 4.15.4 Adjust title font size for mobile (28px)
- [ ] 4.15.5 Adjust description font size for mobile (14px)
- [ ] 4.15.6 Set spacing between elements to 16px on mobile

## Phase 5: PWA Manifest for Android

### 5.1 Create PWA Manifest File
- [x] 5.1.1 Create `frontend/public/manifest.json` file
- [ ] 5.1.2 Set name: "Byline Attendance Management"
- [ ] 5.1.3 Set short_name: "Byline Attendance"
- [ ] 5.1.4 Set description: "Attendance management system for Byline Learning"
- [ ] 5.1.5 Set start_url: "/"
- [ ] 5.1.6 Set display: "standalone"
- [ ] 5.1.7 Set theme_color: "#D32F2F"
- [ ] 5.1.8 Set background_color: "#ffffff"
- [ ] 5.1.9 Add icons array with 192px and 512px sizes

### 5.2 Create PWA Icons
- [ ] 5.2.1 Create icon-192x192.png (company logo)
- [ ] 5.2.2 Create icon-512x512.png (company logo)
- [ ] 5.2.3 Place icons in `frontend/public/` directory
- [ ] 5.2.4 Ensure icons have transparent background
- [ ] 5.2.5 Ensure icons are optimized for file size

### 5.3 Link Manifest in HTML
- [x] 5.3.1 Add <link rel="manifest" href="/manifest.json"> to index.html
- [x] 5.3.2 Add <meta name="theme-color" content="#D32F2F"> to index.html
- [x] 5.3.3 Add <meta name="apple-mobile-web-app-capable" content="yes"> for iOS
- [x] 5.3.4 Add <meta name="apple-mobile-web-app-status-bar-style" content="default">

## Phase 6: Testing and Validation

### 6.1 Desktop Regression Testing
- [ ] 6.1.1 Test all pages at 1440px viewport width
- [ ] 6.1.2 Compare screenshots before and after changes
- [ ] 6.1.3 Verify sidebar width is 70px
- [ ] 6.1.4 Verify main content padding is 88px 32px 32px
- [ ] 6.1.5 Verify all tables display as grid/table
- [ ] 6.1.6 Verify no visual regressions

### 6.2 Mobile Breakpoint Testing
- [ ] 6.2.1 Test at 360px (mobile-xs)
- [ ] 6.2.2 Test at 480px (mobile-sm)
- [ ] 6.2.3 Test at 768px (mobile-lg)
- [ ] 6.2.4 Test at 1024px (tablet)
- [ ] 6.2.5 Verify smooth transitions between breakpoints
- [ ] 6.2.6 Verify no horizontal scrolling at any breakpoint

### 6.3 Mobile Menu Testing
- [ ] 6.3.1 Test hamburger menu toggle
- [ ] 6.3.2 Test sidebar slide-in animation
- [ ] 6.3.3 Test backdrop click to close
- [ ] 6.3.4 Test menu item click to close and navigate
- [ ] 6.3.5 Test body scroll lock when menu is open
- [ ] 6.3.6 Test escape key to close menu

### 6.4 Touch Target Testing
- [ ] 6.4.1 Measure all button heights (minimum 44px)
- [ ] 6.4.2 Measure all icon button sizes (minimum 44px × 44px)
- [ ] 6.4.3 Measure all link tap areas (minimum 44px)
- [ ] 6.4.4 Measure sidebar menu item heights (minimum 56px)
- [ ] 6.4.5 Verify spacing between touch targets (minimum 8px)
- [ ] 6.4.6 Test tap feedback visibility

### 6.5 Table Card Transform Testing
- [ ] 6.5.1 Test EmployeesPage table transform
- [ ] 6.5.2 Test AdminLeavesPage table transform
- [ ] 6.5.3 Test AdminAttendanceSummaryPage table transform
- [ ] 6.5.4 Verify all data is visible in card layout
- [ ] 6.5.5 Verify column labels appear correctly
- [ ] 6.5.6 Test reversibility (resize to desktop and back)

### 6.6 Cross-Browser Testing
- [ ] 6.6.1 Test on Chrome Mobile (Android)
- [ ] 6.6.2 Test on Safari Mobile (iOS)
- [ ] 6.6.3 Test on Firefox Mobile
- [ ] 6.6.4 Test on Samsung Internet
- [ ] 6.6.5 Verify CSS media queries work on all browsers
- [ ] 6.6.6 Verify touch events work on all browsers

### 6.7 PWA Installation Testing
- [ ] 6.7.1 Test PWA install prompt on Android Chrome
- [ ] 6.7.2 Test installation to home screen
- [ ] 6.7.3 Test app launch from home screen
- [ ] 6.7.4 Verify full-screen mode
- [ ] 6.7.5 Verify app icon displays correctly
- [ ] 6.7.6 Verify theme color applies to status bar

### 6.8 Performance Testing
- [ ] 6.8.1 Run Lighthouse mobile audit (target score >90)
- [ ] 6.8.2 Measure First Contentful Paint (target <1.5s)
- [ ] 6.8.3 Measure Cumulative Layout Shift (target <0.1)
- [ ] 6.8.4 Test on 3G connection (target load time <3s)
- [ ] 6.8.5 Test animation frame rate (target 60fps)
- [ ] 6.8.6 Check for memory leaks during navigation

### 6.9 Orientation Change Testing
- [ ] 6.9.1 Test portrait to landscape rotation
- [ ] 6.9.2 Test landscape to portrait rotation
- [ ] 6.9.3 Verify layout adjusts smoothly
- [ ] 6.9.4 Verify mobile menu closes on rotation
- [ ] 6.9.5 Verify scroll position is preserved

### 6.10 Accessibility Testing
- [ ] 6.10.1 Run axe DevTools accessibility scan
- [ ] 6.10.2 Test keyboard navigation on mobile
- [ ] 6.10.3 Test screen reader compatibility (TalkBack/VoiceOver)
- [ ] 6.10.4 Verify color contrast ratios (4.5:1 for text)
- [ ] 6.10.5 Verify focus indicators are visible

## Phase 7: Documentation and Deployment

### 7.1 Update Documentation
- [ ] 7.1.1 Document mobile breakpoint system in README
- [ ] 7.1.2 Document mobile menu usage for developers
- [ ] 7.1.3 Document table card transform pattern
- [ ] 7.1.4 Document touch target requirements
- [ ] 7.1.5 Add mobile testing guidelines to docs

### 7.2 Create Developer Guide
- [ ] 7.2.1 Write guide for adding mobile styles to new pages
- [ ] 7.2.2 Write guide for using mobile utility classes
- [ ] 7.2.3 Write guide for testing mobile responsiveness
- [ ] 7.2.4 Add code examples for common mobile patterns

### 7.3 Deployment Preparation
- [ ] 7.3.1 Run full test suite on staging environment
- [ ] 7.3.2 Perform final desktop regression check
- [ ] 7.3.3 Perform final mobile functionality check
- [ ] 7.3.4 Get stakeholder approval for mobile UI
- [ ] 7.3.5 Prepare rollback plan if issues arise

### 7.4 Production Deployment
- [ ] 7.4.1 Deploy to production environment
- [ ] 7.4.2 Monitor error logs for mobile-specific issues
- [ ] 7.4.3 Monitor performance metrics (Lighthouse scores)
- [ ] 7.4.4 Collect user feedback on mobile experience
- [ ] 7.4.5 Address any critical issues within 24 hours

## Notes

- All tasks must be completed in order within each phase
- Desktop layout must be tested after each phase to ensure no regressions
- Mobile menu functionality is critical and must be thoroughly tested
- Touch target sizes are non-negotiable for accessibility compliance
- PWA manifest is optional but recommended for better mobile experience
- Performance testing should be done on real devices, not just emulators
