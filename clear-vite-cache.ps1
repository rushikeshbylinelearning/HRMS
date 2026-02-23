#!/usr/bin/env pwsh
# Clear Vite cache script

Write-Host "Clearing Vite cache..." -ForegroundColor Yellow

# Remove Vite cache
if (Test-Path "frontend/node_modules/.vite") {
    Remove-Item -Recurse -Force "frontend/node_modules/.vite"
    Write-Host "✓ Removed frontend/node_modules/.vite" -ForegroundColor Green
}

# Remove dist folder
if (Test-Path "frontend/dist") {
    Remove-Item -Recurse -Force "frontend/dist"
    Write-Host "✓ Removed frontend/dist" -ForegroundColor Green
}

Write-Host "`nCache cleared successfully!" -ForegroundColor Green
Write-Host "Now restart your dev server with: cd frontend && npm run dev" -ForegroundColor Cyan
