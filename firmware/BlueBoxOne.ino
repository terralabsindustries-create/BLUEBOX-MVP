/*
  BlueBox One - Physical Device Firmware (Arduino IDE)

  Board: ESP32 Dev Module
  Install from Arduino IDE Library Manager:
    - NimBLE-Arduino (h2zero)
    - Adafruit GFX Library
    - Adafruit SSD1306
    - ArduinoJson (Benoit Blanchon)
  Wire is supplied by the ESP32 Arduino board package.

  This sketch uses the same BlueBox One physical-device BLE protocol as
  firmware/BlueBoxOne/src/main.cpp. The Windows control station remains the
  authority: this device only displays and reports the synchronized state.
*/

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <NimBLEDevice.h>
#include <ArduinoJson.h>

// Set a flag to 1 only after the matching peripheral is physically wired.
#define BLUEBOX_ENABLE_TAMPER 0
#define BLUEBOX_ENABLE_BUZZER 0
#define BLUEBOX_ENABLE_LED 0
#define BLUEBOX_ENABLE_TEST_BUTTON 0
#define BLUEBOX_ENABLE_OVERSPEED_D2_LED 1

// ===== CONFIG ===============================================================
namespace Config {
constexpr uint8_t SDA_PIN = 21;
constexpr uint8_t SCL_PIN = 22;
constexpr uint8_t TAMPER_PIN = 27;
constexpr uint8_t BUZZER_PIN = 25;
constexpr uint8_t LED_PIN = 26;
constexpr uint8_t OVERSPEED_D2_LED_PIN = 2;
constexpr char NAME[] = "BlueBox-One-BB1";
constexpr char DEVICE_ID[] = "BB1-PROTOTYPE-01";
constexpr char FIRMWARE[] = "MVP-0.1.0";
constexpr char LINKED_VEHICLE[] = "KL01AB1234";
constexpr char SERVICE_UUID[] = "6E410001-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char STATE_UUID[] = "6E410002-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char EVENT_UUID[] = "6E410003-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char COMMAND_UUID[] = "6E410004-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char HEALTH_UUID[] = "6E410005-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char ACK_UUID[] = "6E410006-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr uint32_t HEALTH_INTERVAL_MS = 5000;
constexpr uint32_t TAMPER_DEBOUNCE_MS = 50;
}

// ===== STATE MODEL =========================================================
struct SyncState {
  int speedKph = 0;
  int roadLimitKph = 80;
  int qualificationElapsedSec = 0;
  int offlineQueueCount = 0;
  uint32_t sequence = 0;
  bool gnssValid = true;
  bool m2mOnline = true;
  bool vehiclePower = true;
  String displayMode = "BOOT";
  String ledState = "WAITING";
  String buzzerCommand = "";
} state;

Adafruit_SSD1306 display(128, 64, &Wire, -1);
NimBLECharacteristic *eventCharacteristic = nullptr;
NimBLECharacteristic *healthCharacteristic = nullptr;
NimBLECharacteristic *ackCharacteristic = nullptr;

bool bleConnected = false;
bool tamperOpen = false;
bool lastTamperReading = false;
bool showStatusPage = false;
bool displayReady = false;
uint32_t lastTamperChangeMs = 0;
uint32_t pageStartedMs = 0;
uint32_t healthSentMs = 0;
uint32_t connectedBannerUntilMs = 0;
uint8_t pendingBeeps = 0;
uint8_t completedBeeps = 0;
bool buzzerOn = false;
uint32_t buzzerPhaseMs = 0;
uint32_t overspeedLedChangedMs = 0;
bool overspeedLedOn = false;

// ===== BLE =================================================================
void notifyJson(NimBLECharacteristic *characteristic, const String &json) {
  if (characteristic == nullptr || !bleConnected) return;
  characteristic->setValue(json.c_str());
  characteristic->notify();
}

void sendAck(uint32_t sequence) {
  String json = "{\"type\":\"ack\",\"sequence\":" + String(sequence) +
                ",\"status\":\"APPLIED\"}";
  notifyJson(ackCharacteristic, json);
  Serial.printf("[ACK] sequence=%lu\n", static_cast<unsigned long>(sequence));
}

void sendTamperEvent() {
  const String json = "{\"protocolVersion\":\"1.0\",\"type\":\"physical_event\","
                      "\"source\":\"PHYSICAL_BLUEBOX\",\"eventType\":\"TAMPER_OPEN_EVENT\","
                      "\"deviceId\":\"BB1-PROTOTYPE-01\",\"linkedVehicle\":\"KL01AB1234\","
                      "\"tamperStatus\":\"CASE_OPEN\"}";
  notifyJson(eventCharacteristic, json);
  Serial.println("[EVENT] TAMPER_OPEN");
}

void sendHealth() {
  if (!bleConnected) return;
  // Keep health compact enough for a single BLE notification.
  const String displayStatus = tamperOpen ? "TAMPER" : (displayReady ? "READY" : "ERROR");
#if BLUEBOX_ENABLE_TAMPER
  const String tamperStatus = tamperOpen ? "CASE_OPEN" : "NORMAL";
#else
  const String tamperStatus = "DISABLED";
#endif
#if BLUEBOX_ENABLE_LED
  const String ledStatus = digitalRead(Config::LED_PIN) == HIGH ? "ON" : "OFF";
#else
  const String ledStatus = "DISABLED";
#endif
#if BLUEBOX_ENABLE_BUZZER
  const String buzzerStatus = buzzerOn ? "ACTIVE" : "IDLE";
#else
  const String buzzerStatus = "DISABLED";
#endif
  const String json = "{\"type\":\"health\",\"deviceId\":\"BB1-PROTOTYPE-01\","
                      "\"firmware\":\"MVP-0.1.0\",\"uptime\":" + String(millis() / 1000) +
                      ",\"displayStatus\":\"" + displayStatus + "\",\"tamperStatus\":\"" +
                      tamperStatus + "\",\"bleConnected\":" +
                      String(bleConnected ? "true" : "false") + ",\"lastAppliedSequence\":" +
                      String(state.sequence) + ",\"oledStatus\":\"" +
                      String(displayReady ? "READY" : "ERROR") + "\",\"ledStatus\":\"" +
                      ledStatus + "\",\"buzzerStatus\":\"" + buzzerStatus +
                      "\"}";
  notifyJson(healthCharacteristic, json);
}

// ===== DISPLAY =============================================================
void beginFrame() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(false);
}

void centered(const String &text, int y, uint8_t size) {
  display.setTextSize(size);
  int16_t x1, y1;
  uint16_t width, height;
  display.getTextBounds(text, 0, y, &x1, &y1, &width, &height);
  display.setCursor((128 - width) / 2, y);
  display.print(text);
}

void renderLines(const String &line1, const String &line2 = "", const String &line3 = "") {
  if (!displayReady) return;
  beginFrame();
  centered("BLUEBOX ONE", 1, 1);
  centered(line1, 20, 2);
  centered(line2, 44, 1);
  centered(line3, 55, 1);
  display.display();
}

void renderSpeedPage() {
  if (!displayReady) return;
  beginFrame();
  centered("BLUEBOX ONE", 1, 1);
  const String speed = String(state.speedKph);
  centered(speed, 15, 4);
  centered("km/h", 48, 1);
  centered("LIM " + String(state.roadLimitKph), 56, 1);
  display.display();
}

void renderStatusPage() {
  if (!displayReady) return;
  beginFrame();
  centered(String("GNSS ") + (state.gnssValid ? "OK" : "LOST"), 1, 1);
  centered(String(state.speedKph), 15, 4);
  centered("km/h", 48, 1);
  centered(state.m2mOnline ? "M2M ONLINE" : "M2M OFFLINE", 56, 1);
  display.display();
}
void renderOverspeedLive(const String &phase) {
  if (!displayReady) return;
  beginFrame();
  centered("OVERSPEED", 1, 1);
  centered(String(state.speedKph), 15, 4);
  centered("km/h", 48, 1);
  centered(phase, 56, 1);
  display.display();
}

void renderQualification() { renderOverspeedLive(String(state.qualificationElapsedSec) + "/10s  LIM " + String(state.roadLimitKph)); }
void renderOffline() { renderLines("M2M OFFLINE", state.offlineQueueCount > 0 ? "EVENT STORED" : "LOCAL MODE", state.offlineQueueCount > 0 ? "QUEUE " + String(state.offlineQueueCount) : ""); }
void renderTamper() { renderLines("TAMPER", "CASE OPEN", "EVENT SENT"); }
void renderGnssLost() { renderLines("GNSS LOST", "VALIDATION", "PAUSED"); }
void renderVerified() { renderLines("EVENT", "VERIFIED", "OK"); }

void renderCurrentState() {
  const uint32_t now = millis();
  if (tamperOpen) { renderTamper(); return; }
  if (!bleConnected) { renderLines("LINK LOST", "WAITING"); return; }
  if (now < connectedBannerUntilMs) { renderLines("CONNECTED", "SYNC"); return; }
  if (state.displayMode == "ERROR") { renderLines("ERROR", "CHECK DEVICE"); return; }
  if (!state.gnssValid || state.displayMode == "GNSS_LOST") { renderGnssLost(); return; }
  if (!state.vehiclePower || state.displayMode == "POWER_LOSS") { renderLines("VEH POWER", "LOST", "BACKUP MODE"); return; }
  if (state.displayMode == "OVERSPEED_EVENT") { renderOverspeedLive("EVENT CREATED"); return; }
  if (state.displayMode == "EVENT_SIGNED") { renderOverspeedLive("EVENT SIGNED"); return; }
  if (state.displayMode == "EVENT_VERIFIED") { renderVerified(); return; }
  if (state.displayMode == "OVERSPEED_QUALIFYING") { renderQualification(); return; }
  if (!state.m2mOnline || state.offlineQueueCount > 0 || state.displayMode == "EVENT_QUEUED" || state.displayMode == "M2M_OFFLINE") { renderOffline(); return; }
  if (state.displayMode == "NEAR_LIMIT") { renderLines("NEAR LIMIT", String(state.speedKph) + " km/h", "LIM " + String(state.roadLimitKph)); return; }
  if (showStatusPage) {
    renderStatusPage();
    if (now - pageStartedMs >= 1500) { showStatusPage = false; pageStartedMs = now; }
  } else {
    renderSpeedPage();
    if (now - pageStartedMs >= 3500) { showStatusPage = true; pageStartedMs = now; }
  }
}

// ===== LED / BUZZER ========================================================
void queueBeeps(uint8_t count) {
#if BLUEBOX_ENABLE_BUZZER
  pendingBeeps = count;
  completedBeeps = 0;
  buzzerOn = false;
  buzzerPhaseMs = millis();
#else
  (void)count;
#endif
}

void updateBuzzer() {
#if BLUEBOX_ENABLE_BUZZER
  const uint32_t now = millis();
  if (pendingBeeps == 0) { digitalWrite(Config::BUZZER_PIN, LOW); return; }
  if (!buzzerOn && now - buzzerPhaseMs >= 100) {
    if (completedBeeps >= pendingBeeps) { pendingBeeps = 0; digitalWrite(Config::BUZZER_PIN, LOW); return; }
    buzzerOn = true;
    buzzerPhaseMs = now;
    tone(Config::BUZZER_PIN, 2600);
  } else if (buzzerOn && now - buzzerPhaseMs >= 110) {
    noTone(Config::BUZZER_PIN);
    buzzerOn = false;
    buzzerPhaseMs = now;
    completedBeeps++;
  }
#endif
}

void updateLed() {
#if BLUEBOX_ENABLE_LED
  const uint32_t tick = millis();
  bool on;
  if (tamperOpen) on = (tick / 120) % 2 == 0;
  else if (!bleConnected) on = (tick / 900) % 2 == 0;
  else if (state.displayMode == "OVERSPEED_QUALIFYING") on = (tick / 350) % 2 == 0;
  else if (!state.m2mOnline) { uint32_t phase = tick % 1200; on = phase < 120 || (phase >= 240 && phase < 360); }
  else on = true;
  digitalWrite(Config::LED_PIN, on ? HIGH : LOW);
#endif
}

void updateOverspeedD2Led() {
#if BLUEBOX_ENABLE_OVERSPEED_D2_LED
  const bool overspeed = state.speedKph > state.roadLimitKph + 6;
  if (!overspeed) {
    overspeedLedOn = false;
    digitalWrite(Config::OVERSPEED_D2_LED_PIN, LOW);
    return;
  }

  // Higher speed-to-limit ratios produce a faster, clearly visible blink.
  const float ratio = static_cast<float>(state.speedKph) / max(1, state.roadLimitKph);
  const uint32_t intervalMs = constrain(static_cast<int>(800 - (ratio - 1.0f) * 1800), 100, 700);
  const uint32_t now = millis();
  if (now - overspeedLedChangedMs >= intervalMs) {
    overspeedLedChangedMs = now;
    overspeedLedOn = !overspeedLedOn;
    digitalWrite(Config::OVERSPEED_D2_LED_PIN, overspeedLedOn ? HIGH : LOW);
  }
#endif
}

// ===== STATE / TAMPER ======================================================
void applyBuzzerCommand(const String &command) {
  if (command == "EVENT_BEEP") queueBeeps(2);
  else if (command == "TAMPER_BEEP") queueBeeps(3);
  else if (command == "CONNECT_BEEP") queueBeeps(1);
}

void applyState(const String &payload) {
  StaticJsonDocument<768> doc;
  DeserializationError error = deserializeJson(doc, payload);
  if (error) { Serial.printf("[STATE] invalid JSON: %s\n", error.c_str()); return; }

  state.speedKph = round(doc["speedKph"] | state.speedKph);
  state.roadLimitKph = doc["roadLimitKph"] | state.roadLimitKph;
  state.sequence = doc["sequence"] | state.sequence;
  state.offlineQueueCount = doc["offlineQueueCount"] | 0;
  state.qualificationElapsedSec = doc["qualificationElapsedSec"] | 0;
  state.gnssValid = String(doc["gnssStatus"] | "VALID") != "LOST";
  state.m2mOnline = String(doc["m2mNetwork"] | "ONLINE") != "OFFLINE";
  state.vehiclePower = String(doc["powerStatus"] | "NORMAL") != "LOSS";
  state.displayMode = String(doc["displayMode"] | "NORMAL_DRIVE");
  state.ledState = String(doc["ledState"] | "READY");
  state.buzzerCommand = String(doc["buzzerCommand"] | "");
  applyBuzzerCommand(state.buzzerCommand);
  pageStartedMs = millis();
  Serial.printf("[STATE] speed=%d\n", state.speedKph);
  sendAck(state.sequence);
}

void updateTamper() {
#if BLUEBOX_ENABLE_TAMPER
  const uint32_t now = millis();
  const bool reading = digitalRead(Config::TAMPER_PIN) == LOW;
  if (reading != lastTamperReading) {
    lastTamperReading = reading;
    lastTamperChangeMs = now;
  }
  if (now - lastTamperChangeMs < Config::TAMPER_DEBOUNCE_MS || reading == tamperOpen) return;
  tamperOpen = reading;
  if (tamperOpen) {
    sendTamperEvent();
    queueBeeps(3);
  }
#endif
}

class StateCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *characteristic, NimBLEConnInfo &) override {
    applyState(String(characteristic->getValue().c_str()));
  }
};

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer *, NimBLEConnInfo &) override {
    bleConnected = true;
    connectedBannerUntilMs = millis() + 1200;
    queueBeeps(1);
    Serial.println("[BLE] Control station connected");
  }
  void onDisconnect(NimBLEServer *, NimBLEConnInfo &, int) override {
    bleConnected = false;
    NimBLEDevice::startAdvertising();
    Serial.println("[BLE] disconnected");
    Serial.println("[BLE] Advertising BlueBox-One-BB1");
  }
};

void setupBle() {
  NimBLEDevice::init(Config::NAME);
  NimBLEServer *server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  NimBLEService *service = server->createService(Config::SERVICE_UUID);
  NimBLECharacteristic *stateCharacteristic = service->createCharacteristic(Config::STATE_UUID, NIMBLE_PROPERTY::WRITE);
  eventCharacteristic = service->createCharacteristic(Config::EVENT_UUID, NIMBLE_PROPERTY::NOTIFY);
  service->createCharacteristic(Config::COMMAND_UUID, NIMBLE_PROPERTY::WRITE);
  healthCharacteristic = service->createCharacteristic(Config::HEALTH_UUID, NIMBLE_PROPERTY::NOTIFY);
  ackCharacteristic = service->createCharacteristic(Config::ACK_UUID, NIMBLE_PROPERTY::NOTIFY);
  stateCharacteristic->setCallbacks(new StateCallbacks());
  service->start();
  NimBLEAdvertising *advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(Config::SERVICE_UUID);
  advertising->start();
  Serial.println("[BLE] Advertising BlueBox-One-BB1");
}

// ===== SETUP / LOOP ========================================================
void setup() {
  Serial.begin(115200);
  Serial.println("[BB1] BlueBox One starting");
#if BLUEBOX_ENABLE_TAMPER
  pinMode(Config::TAMPER_PIN, INPUT_PULLUP);
#endif
#if BLUEBOX_ENABLE_LED
  pinMode(Config::LED_PIN, OUTPUT);
  digitalWrite(Config::LED_PIN, LOW);
#endif
#if BLUEBOX_ENABLE_BUZZER
  pinMode(Config::BUZZER_PIN, OUTPUT);
  digitalWrite(Config::BUZZER_PIN, LOW);
#endif
#if BLUEBOX_ENABLE_OVERSPEED_D2_LED
  pinMode(Config::OVERSPEED_D2_LED_PIN, OUTPUT);
  digitalWrite(Config::OVERSPEED_D2_LED_PIN, LOW);
#endif

  Wire.begin(Config::SDA_PIN, Config::SCL_PIN);
  displayReady = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (displayReady) {
    Serial.println("[DISPLAY] READY");
    renderLines("STARTING");
  } else {
    Serial.println("[DISPLAY] ERROR");
  }
#if BLUEBOX_ENABLE_TAMPER
  lastTamperReading = digitalRead(Config::TAMPER_PIN) == LOW;
  tamperOpen = lastTamperReading;
#endif
  setupBle();
  pageStartedMs = millis();
}

void loop() {
  const uint32_t now = millis();
#if BLUEBOX_ENABLE_TAMPER
  updateTamper();
#endif
#if BLUEBOX_ENABLE_LED
  updateLed();
#endif
#if BLUEBOX_ENABLE_BUZZER
  updateBuzzer();
#endif
  updateOverspeedD2Led();
  if (now - healthSentMs >= Config::HEALTH_INTERVAL_MS) {
    healthSentMs = now;
    sendHealth();
  }
  renderCurrentState();
}
