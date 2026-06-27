@echo off
title InkOS Studio (本地源码)
cd /d C:\Users\ZhuanZ\Desktop\inkos-dev
echo ============================================
echo   InkOS Studio
echo   http://localhost:4570
echo ============================================
echo.
echo [1/2] Recompiling modified source code...
npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed! Check the error messages above.
    pause
    exit /b 1
)
echo [2/2] Build complete. Starting...
echo.
node packages\cli\dist\index.js studio --port 4570
pause
