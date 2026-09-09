@echo off
setlocal

set "WORKSPACE=%~dp0"
echo Stopping BlueBox servers and BLE bridge...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$workspace = [System.IO.Path]::GetFullPath($env:WORKSPACE).TrimEnd('\'); $processes = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($workspace, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and (($_.Name -in @('node.exe', 'BlueBox.BleBridge.exe')) -or ($_.Name -eq 'powershell.exe' -and $_.CommandLine -match 'bridge\\windows-ble')) }; foreach ($process in $processes) { try { Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop; Write-Host ('Stopped {0} (PID {1})' -f $process.Name, $process.ProcessId) } catch { Write-Warning ('Could not stop PID {0}: {1}' -f $process.ProcessId, $_.Exception.Message) } }"

echo.
echo BlueBox processes stopped.
pause
