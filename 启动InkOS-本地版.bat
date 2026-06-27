@echo off
title InkOS Studio (本地修改版本)
cd /d C:\Users\ZhuanZ\Desktop\inkos-dev
echo ============================================
echo   InkOS Studio (本地修改版本)
echo   http://localhost:4570
echo ============================================
echo.
echo [1/2] 正在编译最新代码...
call pnpm -r build
if errorlevel 1 (
    echo.
    echo [错误] 编译失败，请检查错误信息
    pause
    exit /b 1
)
echo [2/2] 启动 Studio...
echo.
node packages\cli\dist\index.js studio --port 4570
pause
