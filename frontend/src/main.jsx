// frontend/src/main.jsx
import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/PerformanceOptimizations.css' // Performance optimizations
import './utils/quietConsole.js'
// Suppress false positive prop type warnings from MUI 7 + React 18
import './utils/suppressPropWarnings.js'

// CRITICAL: Layout mutation audit system (DEV ONLY)
import { auditLayoutMutations } from './utils/layoutMutationAudit.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Start layout mutation audit in development
if (import.meta.env.DEV) {
  // Wait for initial render, then start audit
  setTimeout(() => {
    auditLayoutMutations();
  }, 1000);
}