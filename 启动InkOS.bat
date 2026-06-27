@echo off
title InkOS Studio
cd /d "C:\Users\ZhuanZ\Desktop\inkos-dev"

echo ============================================
echo   InkOS Studio
echo ============================================
echo.

:: Kill any existing process on port 4570
echo Checking port 4570...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4570" ^| findstr "LISTENING"') do (
    echo Found process %%a on port 4570, killing it...
    taskkill /PID %%a /F >nul 2>&1
    if errorlevel 1 (
        echo Trying alternative method...
        powershell.exe -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
    )
)

:: Check if build is needed (check dist directory existence and key entry files)
echo Checking build status...
node -e "const fs = require('fs'); const checks = [ 'packages/core/dist/pipeline/runner.js', 'packages/cli/dist/index.js', 'packages/studio/dist/api/server.js', 'packages/studio/dist/index.html' ]; let needRebuild = false; for (const f of checks) { if (!fs.existsSync(f)) { console.log('Missing: ' + f); needRebuild = true; break; } } if (!needRebuild) { console.log('Build up to date'); process.exit(0); } else { process.exit(1); }" 2>&1

if errorlevel 1 (
    echo.
    echo Building... (first time may take 1-2 minutes)
    pnpm build
    if errorlevel 1 (
        echo pnpm build failed, trying npm run build...
        npm run build
        if errorlevel 1 (
            echo.
            echo Build failed! Check errors above
            pause
            exit /b 1
        )
    )
    echo Build complete!
)

echo.
echo ============================================
echo   Starting Studio...
echo   http://localhost:4570
echo ============================================
echo.

node packages\cli\dist\index.js studio --port 4570
pause
