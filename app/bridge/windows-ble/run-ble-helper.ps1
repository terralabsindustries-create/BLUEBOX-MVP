param([ValidateSet("scan", "connect")][string]$Mode = "connect")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot; $output = Join-Path $PSScriptRoot "BlueBox.BleBridge.exe"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$references = @("C:\Program Files (x86)\Windows Kits\10\UnionMetadata\10.0.26100.0\Windows.winmd", "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Runtime.dll", "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Runtime.WindowsRuntime.dll", "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Runtime.InteropServices.WindowsRuntime.dll")
if ($env:BLUEBOX_USE_PREBUILT_HELPER -eq "1" -and (Test-Path $output)) {
  & $output $Mode
  exit $LASTEXITCODE
}
if (-not (Test-Path $output) -or (Get-Item (Join-Path $PSScriptRoot "Program.cs")).LastWriteTime -gt (Get-Item $output).LastWriteTime) {
  & $csc /nologo /target:exe /out:$output ($references | ForEach-Object { "/reference:$_" }) (Join-Path $PSScriptRoot "Program.cs")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& $output $Mode
