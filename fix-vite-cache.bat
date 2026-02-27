@echo off
echo Fixing Vite cache issue...
cd frontend
echo Removing Vite cache...
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"
if exist ".vite" rmdir /s /q ".vite"
echo Cache cleared!
echo.
echo Please restart your dev server with: npm run dev
pause
