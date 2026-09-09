@echo off
setlocal
title BlueBox One Dashboard Launcher

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is required to start BlueBox One.
  echo Install the current LTS version from https://nodejs.org, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing BlueBox One dependencies. This only happens once...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Please check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo Starting BlueBox One MVP Dashboard...
start "BlueBox One Dashboard" /d "%~dp0" cmd /k npm run dev

echo Waiting for the dashboard to be ready...
powershell -NoProfile -Command "$until = (Get-Date).AddSeconds(45); do { if (Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet) { Start-Process 'http://localhost:3000'; exit 0 }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $until); Start-Process 'http://localhost:3000'"

endlocal
