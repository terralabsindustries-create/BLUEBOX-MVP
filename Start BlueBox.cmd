@echo off
setlocal
cd /d "%~dp0app"
set "BLUEBOX_BRIDGE_MODE=real"
set "MOCK_PHYSICAL_BLUEBOX=false"
set "BLUEBOX_USE_PREBUILT_HELPER=1"

start "BlueBox Dashboard" /min "%~dp0runtime\node.exe" node_modules\next\dist\bin\next start -p 3000
timeout /t 3 /nobreak >nul
start "BlueBox BLE Bridge" /min "%~dp0runtime\node.exe" node_modules\tsx\dist\cli.mjs bridge\src\index.ts
timeout /t 2 /nobreak >nul
start "" http://localhost:3000/dashboard
endlocal
