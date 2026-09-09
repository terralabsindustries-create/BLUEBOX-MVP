using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Foundation;
using Windows.Security.Cryptography;

public static class Program
{
    static readonly Guid ServiceId = new Guid("6E420001-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid TelemetryId = new Guid("6E420002-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid EventId = new Guid("6E420003-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid CommandId = new Guid("6E420004-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid HealthId = new Guid("6E420005-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid AckId = new Guid("6E420006-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid PhysicalServiceId = new Guid("6E410001-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid PhysicalStateId = new Guid("6E410002-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid PhysicalEventId = new Guid("6E410003-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid PhysicalHealthId = new Guid("6E410005-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Guid PhysicalAckId = new Guid("6E410006-B5A3-F393-E0A9-E50E24DCCA9E");
    static readonly Dictionary<string, SortedDictionary<int, byte[]>> Frames = new Dictionary<string, SortedDictionary<int, byte[]>>();
    static GattCharacteristic physicalStateCharacteristic;
    static int physicalSequence;
    static string lastPhysicalState;
    static string lastPhysicalTelemetryFingerprint;
    static DateTime lastAndroidTelemetryAt = DateTime.MinValue;
    static readonly object PhysicalStateLock = new object();
    static bool physicalStateDirty;
    static bool physicalStateWriterActive;

    public static void Main(string[] args) { RunAsync(args.Length > 0 ? args[0].ToLowerInvariant() : "connect").GetAwaiter().GetResult(); }

    static async Task RunAsync(string mode)
    {
        if (mode != "scan") RunPhysicalLoopAsync();
        Log("status", "scanning", "Scanner started");
        while (true)
        {
            ulong address = await ScanAsync();
            if (mode == "scan") return;
            try { await ConnectAsync(address); }
            catch (Exception ex) { Log("diagnostic", "error", ex.Message); }
            Log("status", "scanning", "Android disconnected. Reconnecting...");
            await Task.Delay(3000);
        }
    }

    static async Task RunPhysicalLoopAsync()
    {
        Log("physical_status", "scanning", "Scanning for BlueBox-One-BB1");
        while (true)
        {
            try
            {
                ulong address = await ScanPhysicalAsync();
                await ConnectPhysicalAsync(address);
            }
            catch (Exception ex) { Log("physical_status", "error", ex.Message); }
            physicalStateCharacteristic = null;
            Log("physical_status", "scanning", "Physical BlueBox disconnected. Reconnecting...");
            await Task.Delay(3000);
        }
    }

    static Task<ulong> ScanAsync()
    {
        var result = new TaskCompletionSource<ulong>();
        var watcher = new BluetoothLEAdvertisementWatcher { ScanningMode = BluetoothLEScanningMode.Active };
        var handler = new TypedEventHandler<BluetoothLEAdvertisementWatcher, BluetoothLEAdvertisementReceivedEventArgs>((_, args) =>
        {
            bool match = args.Advertisement.LocalName == "BlueBox-VehicleSim";
            foreach (var service in args.Advertisement.ServiceUuids) match |= service == ServiceId;
            if (!match || result.Task.IsCompleted) return;
            Console.WriteLine("{\"kind\":\"found\",\"name\":\"BlueBox-VehicleSim\",\"address\":\"" + args.BluetoothAddress.ToString("X") + "\",\"rssi\":" + args.RawSignalStrengthInDBm + ",\"serviceMatch\":true}");
            result.TrySetResult(args.BluetoothAddress);
        });
        // C# cannot subscribe to WinRT events directly with the inbox compiler, so call the generated accessor by reflection.
        typeof(BluetoothLEAdvertisementWatcher).GetMethod("add_Received").Invoke(watcher, new object[] { handler });
        watcher.Start();
        return result.Task.ContinueWith(task => { watcher.Stop(); return task.Result; });
    }

    static Task<ulong> ScanPhysicalAsync()
    {
        var result = new TaskCompletionSource<ulong>();
        var watcher = new BluetoothLEAdvertisementWatcher { ScanningMode = BluetoothLEScanningMode.Active };
        var handler = new TypedEventHandler<BluetoothLEAdvertisementWatcher, BluetoothLEAdvertisementReceivedEventArgs>((_, args) =>
        {
            bool match = args.Advertisement.LocalName == "BlueBox-One-BB1";
            foreach (var service in args.Advertisement.ServiceUuids) match |= service == PhysicalServiceId;
            if (!match || result.Task.IsCompleted) return;
            Console.WriteLine("{\"kind\":\"physical_found\",\"name\":\"BlueBox-One-BB1\",\"address\":\"" + args.BluetoothAddress.ToString("X") + "\",\"rssi\":" + args.RawSignalStrengthInDBm + "}");
            result.TrySetResult(args.BluetoothAddress);
        });
        typeof(BluetoothLEAdvertisementWatcher).GetMethod("add_Received").Invoke(watcher, new object[] { handler });
        watcher.Start();
        return result.Task.ContinueWith(task => { watcher.Stop(); return task.Result; });
    }

    static async Task ConnectAsync(ulong address)
    {
        Log("status", "connecting", "Connecting to BlueBox-VehicleSim");
        using (var device = await BluetoothLEDevice.FromBluetoothAddressAsync(address).AsTask())
        {
            if (device == null) throw new InvalidOperationException("Windows could not create the BLE device object.");
            Log("status", "connecting", "Device object created; discovering GATT service uncached");
            var services = await device.GetGattServicesForUuidAsync(ServiceId, BluetoothCacheMode.Uncached).AsTask();
            if (services.Status != GattCommunicationStatus.Success || services.Services.Count == 0) throw new InvalidOperationException("BlueBox service UUID not found: " + services.Status);
            using (var service = services.Services[0])
            {
                var telemetry = await CharacteristicAsync(service, TelemetryId, "Telemetry", true);
                var command = await CharacteristicAsync(service, CommandId, "Command", false);
                var eventCharacteristic = await CharacteristicAsync(service, EventId, "Event", false);
                var health = await CharacteristicAsync(service, HealthId, "Health", false);
                var ack = await CharacteristicAsync(service, AckId, "ACK", false);
                await SubscribeAsync(telemetry, "telemetry");
                if (eventCharacteristic != null) await SubscribeAsync(eventCharacteristic, "event");
                if (health != null) await SubscribeAsync(health, "health");
                if (ack != null) await SubscribeAsync(ack, "ack");
                lastAndroidTelemetryAt = DateTime.UtcNow;
                await WriteAsync(command, "REQUEST_STATE");
                Log("status", "connected", "Telemetry notifications enabled; state synchronized");
                var disconnected = new TaskCompletionSource<bool>();
                device.ConnectionStatusChanged += (_, __) => { if (device.ConnectionStatus == BluetoothConnectionStatus.Disconnected) disconnected.TrySetResult(true); };
                while (!disconnected.Task.IsCompleted)
                {
                    await Task.WhenAny(disconnected.Task, Task.Delay(1000));
                    if (!disconnected.Task.IsCompleted)
                    {
                        if (DateTime.UtcNow - lastAndroidTelemetryAt > TimeSpan.FromSeconds(5))
                            throw new InvalidOperationException("Android telemetry timed out; reconnecting BLE link.");
                        await WriteAsync(command, "REQUEST_STATE");
                    }
                }
            }
        }
    }

    static async Task ConnectPhysicalAsync(ulong address)
    {
        Log("physical_status", "connecting", "Connecting to BlueBox-One-BB1");
        using (var device = await BluetoothLEDevice.FromBluetoothAddressAsync(address).AsTask())
        {
            if (device == null) throw new InvalidOperationException("Windows could not create the Physical BlueBox device object.");
            var services = await device.GetGattServicesForUuidAsync(PhysicalServiceId, BluetoothCacheMode.Uncached).AsTask();
            if (services.Status != GattCommunicationStatus.Success || services.Services.Count == 0) throw new InvalidOperationException("Physical BlueBox service UUID not found: " + services.Status);
            using (var service = services.Services[0])
            {
                physicalStateCharacteristic = await CharacteristicAsync(service, PhysicalStateId, "Physical State", true);
                var physicalEvent = await CharacteristicAsync(service, PhysicalEventId, "Physical Event", false);
                var physicalHealth = await CharacteristicAsync(service, PhysicalHealthId, "Physical Health", false);
                var physicalAck = await CharacteristicAsync(service, PhysicalAckId, "Physical ACK", false);
                if (physicalEvent != null) await SubscribeAsync(physicalEvent, "physical_event");
                if (physicalHealth != null) await SubscribeAsync(physicalHealth, "physical_health");
                if (physicalAck != null) await SubscribeAsync(physicalAck, "physical_ack");
                Log("physical_status", "connected", "Physical BlueBox synchronized");
                if (!String.IsNullOrEmpty(lastPhysicalState)) QueuePhysicalState(lastPhysicalState);
                var disconnected = new TaskCompletionSource<bool>();
                device.ConnectionStatusChanged += (_, __) => { if (device.ConnectionStatus == BluetoothConnectionStatus.Disconnected) disconnected.TrySetResult(true); };
                await disconnected.Task;
            }
        }
    }

    static async Task<GattCharacteristic> CharacteristicAsync(GattDeviceService service, Guid id, string label, bool required)
    {
        var result = await service.GetCharacteristicsForUuidAsync(id, BluetoothCacheMode.Uncached).AsTask();
        if (result.Status != GattCommunicationStatus.Success || result.Characteristics.Count == 0)
        {
            if (required) throw new InvalidOperationException(label + " characteristic missing: " + id);
            return null;
        }
        var value = result.Characteristics[0];
        Console.Error.WriteLine("[BLE] " + label + " characteristic found " + id + " properties=" + value.CharacteristicProperties);
        return value;
    }

    static async Task SubscribeAsync(GattCharacteristic characteristic, string channel)
    {
        var handler = new TypedEventHandler<GattCharacteristic, GattValueChangedEventArgs>((_, args) => Decode(channel, args.CharacteristicValue));
        typeof(GattCharacteristic).GetMethod("add_ValueChanged").Invoke(characteristic, new object[] { handler });
        var status = await characteristic.WriteClientCharacteristicConfigurationDescriptorAsync(GattClientCharacteristicConfigurationDescriptorValue.Notify).AsTask();
        if (status != GattCommunicationStatus.Success) throw new InvalidOperationException(channel + " CCCD subscription failed: " + status);
        Console.Error.WriteLine("[BLE] " + channel + " notifications enabled");
    }

    static async Task WriteAsync(GattCharacteristic command, string commandText)
    {
        var data = CryptographicBuffer.ConvertStringToBinary(commandText, BinaryStringEncoding.Utf8);
        var status = await command.WriteValueAsync(data).AsTask();
        if (status != GattCommunicationStatus.Success) throw new InvalidOperationException("Command write failed: " + status);
        Console.Error.WriteLine("[BLE TX] " + commandText);
    }

    static async Task WritePhysicalStateAsync(string json)
    {
        var characteristic = physicalStateCharacteristic;
        if (characteristic == null) return;
        var data = CryptographicBuffer.ConvertStringToBinary(json, BinaryStringEncoding.Utf8);
        var status = await characteristic.WriteValueAsync(data).AsTask();
        if (status != GattCommunicationStatus.Success) throw new InvalidOperationException("Physical state write failed: " + status);
        Console.Error.WriteLine("[PHYSICAL TX] " + JsonNumber(json, "speedKph", "0") + " km/h, sequence=" + JsonNumber(json, "sequence", "0"));
    }

    static void QueuePhysicalState(string json)
    {
        bool startWriter = false;
        lock (PhysicalStateLock)
        {
            lastPhysicalState = json;
            physicalStateDirty = true;
            if (!physicalStateWriterActive)
            {
                physicalStateWriterActive = true;
                startWriter = true;
            }
        }
        if (startWriter) FlushPhysicalStatesAsync();
    }

    static async Task FlushPhysicalStatesAsync()
    {
        while (true)
        {
            string stateToWrite;
            lock (PhysicalStateLock)
            {
                stateToWrite = lastPhysicalState;
                physicalStateDirty = false;
            }
            try { await WritePhysicalStateAsync(stateToWrite); }
            catch (Exception ex) { Log("physical_status", "error", ex.Message); }
            lock (PhysicalStateLock)
            {
                if (!physicalStateDirty)
                {
                    physicalStateWriterActive = false;
                    return;
                }
            }
        }
    }

    static string JsonString(string json, string property, string fallback)
    {
        var match = Regex.Match(json, "\\\"" + Regex.Escape(property) + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
        return match.Success ? match.Groups[1].Value : fallback;
    }

    static string JsonNumber(string json, string property, string fallback)
    {
        var match = Regex.Match(json, "\\\"" + Regex.Escape(property) + "\\\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
        return match.Success ? match.Groups[1].Value : fallback;
    }

    static void SynchronizePhysicalState(string telemetry)
    {
        string speed = JsonNumber(telemetry, "speedKph", "0");
        string limit = JsonNumber(telemetry, "roadLimitKph", "80");
        string gnss = JsonString(telemetry, "gnssStatus", "VALID");
        string m2m = JsonString(telemetry, "m2mNetwork", "ONLINE");
        double speedValue; Double.TryParse(speed, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out speedValue);
        double limitValue; Double.TryParse(limit, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out limitValue);
        // The physical display uses whole km/h values and should not depend on float parsing.
        speed = Math.Round(speedValue).ToString(System.Globalization.CultureInfo.InvariantCulture);
        limit = Math.Round(limitValue).ToString(System.Globalization.CultureInfo.InvariantCulture);
        string fingerprint = speed + "|" + limit + "|" + gnss + "|" + m2m;
        lock (PhysicalStateLock)
        {
            if (fingerprint == lastPhysicalTelemetryFingerprint) return;
            lastPhysicalTelemetryFingerprint = fingerprint;
        }
        physicalSequence++;
        string mode = gnss == "LOST" ? "GNSS_LOST" : m2m == "OFFLINE" ? "M2M_OFFLINE" : speedValue > limitValue + 6 ? "OVERSPEED_QUALIFYING" : "NORMAL_DRIVE";
        string synchronizedState = "{\"protocolVersion\":\"1.0\",\"type\":\"physical_state\",\"sequence\":" + physicalSequence + ",\"deviceId\":\"BB1-PROTOTYPE-01\",\"vehicle\":\"KL01AB1234\",\"speedKph\":" + speed + ",\"roadLimitKph\":" + limit + ",\"toleranceKph\":6,\"gnssStatus\":\"" + gnss + "\",\"m2mNetwork\":\"" + m2m + "\",\"powerStatus\":\"NORMAL\",\"offlineQueueCount\":0,\"qualificationElapsedSec\":0,\"displayMode\":\"" + mode + "\",\"ledState\":\"READY\",\"buzzerCommand\":\"\"}";
        QueuePhysicalState(synchronizedState);
    }

    static void Decode(string channel, Windows.Storage.Streams.IBuffer buffer)
    {
        byte[] bytes; CryptographicBuffer.CopyToByteArray(buffer, out bytes);
        if (bytes.Length >= 5 && bytes[0] == 0x42 && bytes[1] == 0x31)
        {
            string key = channel + bytes[2]; int part = bytes[3]; int total = bytes[4];
            if (!Frames.ContainsKey(key)) Frames[key] = new SortedDictionary<int, byte[]>();
            var payload = new byte[bytes.Length - 5]; Array.Copy(bytes, 5, payload, 0, payload.Length); Frames[key][part] = payload;
            if (Frames[key].Count != total) return;
            var joined = new List<byte>(); for (int index = 0; index < total; index++) joined.AddRange(Frames[key][index]); Frames.Remove(key);
            bytes = Convert.FromBase64String(Encoding.ASCII.GetString(joined.ToArray()));
        }
        string json = Encoding.UTF8.GetString(bytes);
        if (channel == "telemetry")
        {
            lastAndroidTelemetryAt = DateTime.UtcNow;
            SynchronizePhysicalState(json);
        }
        Console.WriteLine("{\"kind\":\"" + channel + "\",\"payload\":" + json + "}"); Console.Out.Flush();
    }

    static void Log(string kind, string state, string detail) { Console.WriteLine("{\"kind\":\"" + kind + "\",\"state\":\"" + state + "\",\"detail\":\"" + detail.Replace("\"", "'") + "\"}"); Console.Out.Flush(); }
}
