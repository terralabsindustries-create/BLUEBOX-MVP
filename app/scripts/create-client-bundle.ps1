param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\release\BlueBox-One-Client")
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$bundle = [System.IO.Path]::GetFullPath($OutputDirectory)
$zip = "$bundle.zip"

if (Test-Path $bundle) { Remove-Item -LiteralPath $bundle -Recurse -Force }
if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }

$app = Join-Path $bundle "app"
New-Item -ItemType Directory -Force -Path $app, (Join-Path $bundle "runtime"), (Join-Path $bundle "mobile"), (Join-Path $bundle "firmware") | Out-Null

# Keep the runtime self-contained, but exclude local development and generated diagnostic files.
$excluded = @("android", "firmware", "release", ".git", ".idea", "bridge\windows-ble\bridge-live*.log", "bridge\windows-ble\board-serial.log")
Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name -notin @("android", "firmware", "release", ".git", ".idea") } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $app -Recurse -Force
}

Copy-Item -LiteralPath "C:\Program Files\nodejs\node.exe" -Destination (Join-Path $bundle "runtime\node.exe") -Force
Copy-Item -LiteralPath (Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk") -Destination (Join-Path $bundle "mobile\BlueBox-One-Android.apk") -Force
Copy-Item -LiteralPath (Join-Path $root "firmware\BlueBoxOne\Arduino\BlueBoxOne\BlueBoxOne.ino") -Destination (Join-Path $bundle "firmware\BlueBoxOne.ino") -Force

@'
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
'@ | Set-Content -LiteralPath (Join-Path $bundle "Start BlueBox.cmd") -Encoding ASCII

@'
BLUEBOX ONE CLIENT BUNDLE

1. Keep this folder on a Windows 10/11 PC with Bluetooth enabled.
2. Double-click Start BlueBox.cmd.
3. The dashboard opens at http://localhost:3000/dashboard.
4. Install mobile\BlueBox-One-Android.apk once on the Android simulator phone.
5. Flash firmware\BlueBoxOne.ino once using Arduino IDE to the Physical BlueBox.

The dashboard and BLE bridge use the included portable Node runtime. No Node.js installation is required.
Windows Bluetooth hardware is required for Android and Physical BlueBox synchronization.
'@ | Set-Content -LiteralPath (Join-Path $bundle "README-CLIENT.txt") -Encoding ASCII

Compress-Archive -LiteralPath $bundle -DestinationPath $zip -CompressionLevel Optimal
Write-Host "Created $zip"
