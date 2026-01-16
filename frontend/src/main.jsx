// frontend/src/main.jsx
import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/PerformanceOptimizations.css' // Performance optimizations
import './utils/quietConsole.js'
// Suppress false positive prop type warnings from MUI 7 + React 18
import './utils/suppressPropWarnings.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)