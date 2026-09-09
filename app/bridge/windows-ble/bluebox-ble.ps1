param(
  [switch]$ScanOnly,
  [int]$ScanTimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

# Windows PowerShell can access the inbox WinRT BLE APIs without a .NET SDK or native Node module.
Add-Type -Path "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Runtime.WindowsRuntime.dll"

$ServiceUuid = [Guid]"6E420001-B5A3-F393-E0A9-E50E24DCCA9E"
$TelemetryUuid = [Guid]"6E420002-B5A3-F393-E0A9-E50E24DCCA9E"
$EventUuid = [Guid]"6E420003-B5A3-F393-E0A9-E50E24DCCA9E"
$CommandUuid = [Guid]"6E420004-B5A3-F393-E0A9-E50E24DCCA9E"
$HealthUuid = [Guid]"6E420005-B5A3-F393-E0A9-E50E24DCCA9E"
$AckUuid = [Guid]"6E420006-B5A3-F393-E0A9-E50E24DCCA9E"

$WatcherType = [type]::GetType("Windows.Devices.Bluetooth.Advertisement.BluetoothLEAdvertisementWatcher, Windows, ContentType=WindowsRuntime")
$ReceivedArgsType = [type]::GetType("Windows.Devices.Bluetooth.Advertisement.BluetoothLEAdvertisementReceivedEventArgs, Windows, ContentType=WindowsRuntime")
$DeviceType = [type]::GetType("Windows.Devices.Bluetooth.BluetoothLEDevice, Windows, ContentType=WindowsRuntime")
$GattCharacteristicType = [type]::GetType("Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristic, Windows, ContentType=WindowsRuntime")
$GattValueChangedArgsType = [type]::GetType("Windows.Devices.Bluetooth.GenericAttributeProfile.GattValueChangedEventArgs, Windows, ContentType=WindowsRuntime")
$GattConfigType = [type]::GetType("Windows.Devices.Bluetooth.GenericAttributeProfile.GattClientCharacteristicConfigurationDescriptorValue, Windows, ContentType=WindowsRuntime")
$BufferType = [type]::GetType("Windows.Security.Cryptography.CryptographicBuffer, Windows, ContentType=WindowsRuntime")
$BinaryEncodingType = [type]::GetType("Windows.Security.Cryptography.BinaryStringEncoding, Windows, ContentType=WindowsRuntime")

function Send-BridgeMessage($message) { [Console]::Out.WriteLine(($message | ConvertTo-Json -Compress -Depth 8)); [Console]::Out.Flush() }
function Send-Status([string]$state, [string]$detail) { Send-BridgeMessage ([ordered]@{ kind = "status"; state = $state; detail = $detail; timestamp = [DateTime]::UtcNow.ToString("o") }) }
function Send-Diagnostic([string]$level, [string]$detail) { Send-BridgeMessage ([ordered]@{ kind = "diagnostic"; level = $level; detail = $detail; timestamp = [DateTime]::UtcNow.ToString("o") }) }

function Await-WinRt($operation, [type]$resultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq "AsTask" -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1
  } | Select-Object -First 1
  $task = $method.MakeGenericMethod(@($resultType)).Invoke($null, @($operation))
  return $task.GetAwaiter().GetResult()
}

function Await-WinRtAction($operation) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq "AsTask" -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
  } | Select-Object -First 1
  $task = $method.Invoke($null, @($operation))
  $task.GetAwaiter().GetResult()
}

function Get-Bytes($buffer) {
  $bytes = New-Object byte[] $buffer.Length
  [Windows.Security.Cryptography.CryptographicBuffer]::CopyToByteArray($buffer, [ref]$bytes)
  return $bytes
}

function Find-Characteristic($service, [Guid]$uuid) {
  $resultType = [type]::GetType("Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult, Windows, ContentType=WindowsRuntime")
  $result = Await-WinRt ($service.GetCharacteristicsForUuidAsync($uuid)) $resultType
  if ($result.Status.ToString() -ne "Success" -or $result.Characteristics.Count -eq 0) { return $null }
  return $result.Characteristics[0]
}

$fragments = @{}
function Handle-Value([string]$channel, $buffer) {
  try {
    $bytes = Get-Bytes $buffer
    if ($bytes.Length -ge 5 -and $bytes[0] -eq 0x42 -and $bytes[1] -eq 0x31) {
      $id = [int]$bytes[2]; $part = [int]$bytes[3]; $total = [int]$bytes[4]
      if ($total -lt 1 -or $part -ge $total) { throw "Invalid frame header" }
      $key = "$channel-$id"
      if (-not $fragments.ContainsKey($key)) { $fragments[$key] = @{ total = $total; parts = @{} } }
      $fragments[$key].parts[$part] = [byte[]]$bytes[5..($bytes.Length - 1)]
      if ($fragments[$key].parts.Count -eq $total) {
        $joined = New-Object System.Collections.Generic.List[byte]
        for ($index = 0; $index -lt $total; $index++) { $joined.AddRange([byte[]]$fragments[$key].parts[$index]) }
        $fragments.Remove($key)
        $jsonBytes = [Convert]::FromBase64String([Text.Encoding]::ASCII.GetString($joined.ToArray()))
        $payload = [Text.Encoding]::UTF8.GetString($jsonBytes) | ConvertFrom-Json
        Send-BridgeMessage ([ordered]@{ kind = $channel; payload = $payload; timestamp = [DateTime]::UtcNow.ToString("o") })
      }
      return
    }
    $payload = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
    Send-BridgeMessage ([ordered]@{ kind = $channel; payload = $payload; timestamp = [DateTime]::UtcNow.ToString("o") })
  } catch { Send-Diagnostic "warning" "Could not decode $channel notification: $($_.Exception.Message)" }
}

function Connect-BlueBox([UInt64]$address, [string]$name, [int]$rssi) {
  Send-Status "connecting" "Connecting to $name ($('{0:X}' -f $address))"
  $device = Await-WinRt ($DeviceType::FromBluetoothAddressAsync($address)) $DeviceType
  if ($null -eq $device) { throw "Windows could not open the advertised BLE device." }
  $servicesResultType = [type]::GetType("Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult, Windows, ContentType=WindowsRuntime")
  $services = Await-WinRt ($device.GetGattServicesForUuidAsync($ServiceUuid)) $servicesResultType
  if ($services.Status.ToString() -ne "Success" -or $services.Services.Count -eq 0) { throw "BlueBox GATT service discovery failed: $($services.Status)" }
  $service = $services.Services[0]
  $telemetry = Find-Characteristic $service $TelemetryUuid
  $event = Find-Characteristic $service $EventUuid
  $command = Find-Characteristic $service $CommandUuid
  $health = Find-Characteristic $service $HealthUuid
  $ack = Find-Characteristic $service $AckUuid
  if ($null -eq $telemetry -or $null -eq $command) { throw "Required telemetry or command characteristic is missing." }

  $valueHandlerType = [Windows.Foundation.TypedEventHandler``2].MakeGenericType(@($GattCharacteristicType, $GattValueChangedArgsType))
  $handlers = @()
  foreach ($pair in @(@("telemetry", $telemetry), @("event", $event), @("health", $health), @("ack", $ack))) {
    if ($null -eq $pair[1]) { continue }
    $channel = [string]$pair[0]
    $handler = { param($sender, $args) Handle-Value $channel $args.CharacteristicValue }.GetNewClosure() -as $valueHandlerType
    [void]$pair[1].add_ValueChanged($handler); $handlers += $handler
    $configuration = [Enum]::Parse($GattConfigType, "Notify")
    Await-WinRtAction ($pair[1].WriteClientCharacteristicConfigurationDescriptorAsync($configuration))
  }
  $encoding = [Enum]::Parse($BinaryEncodingType, "Utf8")
  $request = $BufferType::ConvertStringToBinary("REQUEST_STATE", $encoding)
  Await-WinRtAction ($command.WriteValueAsync($request))
  Send-BridgeMessage ([ordered]@{ kind = "connected"; name = $name; address = ('{0:X}' -f $address); rssi = $rssi; timestamp = [DateTime]::UtcNow.ToString("o") })
  Send-Status "connected" "Subscribed to live telemetry notifications."
  return @{ device = $device; service = $service; handlers = $handlers }
}

function Start-Scan([bool]$connect) {
  $found = [hashtable]::Synchronized(@{})
  $handlerType = [Windows.Foundation.TypedEventHandler``2].MakeGenericType(@($WatcherType, $ReceivedArgsType))
  $watcher = [Activator]::CreateInstance($WatcherType)
  $watcher.ScanningMode = [Enum]::Parse([type]::GetType("Windows.Devices.Bluetooth.Advertisement.BluetoothLEScanningMode, Windows, ContentType=WindowsRuntime"), "Active")
  $handler = {
    param($sender, $args)
    $name = $args.Advertisement.LocalName
    $services = @($args.Advertisement.ServiceUuids | ForEach-Object { $_.ToString().ToUpperInvariant() })
    $matches = $name -eq "BlueBox-VehicleSim" -or $services -contains $ServiceUuid.ToString().ToUpperInvariant()
    if ($matches) { $found.address = [UInt64]$args.BluetoothAddress; $found.name = if ($name) { $name } else { "BlueBox service" }; $found.rssi = [int]$args.RawSignalStrengthInDBm }
  }.GetNewClosure() -as $handlerType
  [void]$watcher.add_Received($handler); $watcher.Start(); Send-Status "scanning" "Scanning for BlueBox-VehicleSim (service $ServiceUuid)"
  $deadline = [DateTime]::UtcNow.AddSeconds($ScanTimeoutSeconds)
  while (-not $found.ContainsKey("address") -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 200 }
  $watcher.Stop()
  if (-not $found.ContainsKey("address")) { return $null }
  Send-BridgeMessage ([ordered]@{ kind = "found"; name = $found.name; address = ('{0:X}' -f [UInt64]$found.address); rssi = $found.rssi; timestamp = [DateTime]::UtcNow.ToString("o") })
  if (-not $connect) { return @{ scanOnly = $true } }
  return Connect-BlueBox ([UInt64]$found.address) $found.name ([int]$found.rssi)
}

try {
  if ($ScanOnly) { if ($null -eq (Start-Scan $false)) { Send-Diagnostic "error" "No BlueBox-VehicleSim was discovered within $ScanTimeoutSeconds seconds."; exit 2 }; exit 0 }
  while ($true) {
    try {
      $connection = Start-Scan $true
      if ($null -eq $connection) { Send-Diagnostic "warning" "No BlueBox found. Retrying in 5 seconds."; Start-Sleep -Seconds 5; continue }
      while ($true) { Start-Sleep -Seconds 2 }
    } catch { Send-Diagnostic "error" "BLE connection failed: $($_.Exception.Message). Retrying in 5 seconds."; Start-Sleep -Seconds 5 }
  }
} catch { Send-Diagnostic "error" $_.Exception.Message; exit 1 }
