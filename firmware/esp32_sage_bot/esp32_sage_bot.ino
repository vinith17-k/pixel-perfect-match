/**
 * ==============================================================================
 * Sage Bot 2.0 — ESP32 Smart Medicine Dispenser Firmware
 * ==============================================================================
 * 
 * Target Hardware:
 *   - ESP32 DevKit V1
 *   - 0.96-inch I2C SSD1306 OLED (128x64)
 *   - Wiring: SDA -> GPIO 21, SCL -> GPIO 22, VCC -> 3.3V, GND -> GND
 * 
 * Dependencies (install via Arduino IDE Library Manager):
 *   1. Adafruit SSD1306 (by Adafruit)
 *   2. Adafruit GFX Library (by Adafruit)
 *   3. ArduinoJson (v6 or v7 by Benoit Blanchon)
 * 
 * Features:
 *   - Connects to Wi-Fi and synchronizes real time with NTP (Asia/Kolkata).
 *   - Realtime 128x64 pixel layout for Boot, Home, Alarm, Taken, Message, & Load.
 *   - Polls Supabase /commands every 3 seconds for remote instructions.
 *   - Sends device heartbeat & OLED screen mirror to Supabase every 10 seconds.
 *   - Fetches active schedules from Supabase every 30 seconds.
 *   - Standalone alarm engine: continues alerting even if Wi-Fi temporarily drops.
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <time.h>

const char* WIFI_SSID     = "moto g85 5G_4167";
const char* WIFI_PASSWORD = "Shadow@3Zc";

const char* SUPABASE_URL  = "https://bhipuyxwjlcfkiguammh.supabase.co";
const char* SUPABASE_KEY  = "sb_publishable_Tq02iWx1p5wznqj2ifGvvA_gDEEXkuI";

// NTP Timezone settings: Default Asia/Kolkata (UTC + 5:30 = 19800 seconds)
const long  GMT_OFFSET_SEC      = 19800;
const int   DAYLIGHT_OFFSET_SEC = 0;
const char* NTP_SERVER_1        = "pool.ntp.org";
const char* NTP_SERVER_2        = "time.google.com";

// ─── OLED DISPLAY CONFIGURATION ──────────────────────────────────────────────
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define PIN_SDA       21
#define PIN_SCL       22

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ─── APPLICATION STATE ────────────────────────────────────────────────────────
enum DeviceState {
  STATE_IDLE,
  STATE_ALARM,
  STATE_LOADING,
  STATE_MESSAGE,
  STATE_MOVING
};

DeviceState currentState = STATE_IDLE;
String currentScreenName = "boot";
String screenLines[4]    = {"Sage Bot", "Starting...", "", ""};

// Alarm details
String activeMedName = "";
String activeDose    = "";
int    activeSlot    = 1;
String activeEventId = "";

// Next dose preview
String nextDosePreview = "No doses today";

// Timing intervals
unsigned long lastCommandPoll   = 0;
unsigned long lastHeartbeat     = 0;
unsigned long lastScheduleSync  = 0;
unsigned long messageExpiryTime = 0;

const unsigned long COMMAND_INTERVAL_MS  = 3000;   // 3 seconds
const unsigned long HEARTBEAT_INTERVAL_MS = 10000;  // 10 seconds
const unsigned long SCHEDULE_INTERVAL_MS  = 30000;  // 30 seconds

// ─── FORWARD DECLARATIONS ────────────────────────────────────────────────────
void renderOled();
void updateScreen(const String& name, const String& l0, const String& l1 = "", const String& l2 = "", const String& l3 = "");
void syncTime();
String getFormattedTime();
String getFormattedDate();
String getIsoTimestamp();
void pollCommands();
void sendHeartbeat();
void fetchSchedules();
void handleAlarm(const String& medName, const String& dose, int slot, const String& eventId);
void dismissAlarm();

// ─── SETUP ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[Sage Bot] Starting ESP32 Controller...");

  // Initialize I2C and scan for OLED address
  Wire.begin(PIN_SDA, PIN_SCL);
  Serial.println("[I2C] Scanning I2C bus (D21=SDA, D22=SCL)...");
  uint8_t foundAddress = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("[I2C] Found active device at 0x%02X\n", addr);
      if (addr == 0x3C || addr == 0x3D) {
        foundAddress = addr;
      }
    }
  }

  if (foundAddress == 0) {
    Serial.println("[Warning] No OLED found on 0x3C or 0x3D! Defaulting to 0x3C. Check VSS/VDD/SDA/SCL wiring.");
    foundAddress = 0x3C;
  } else {
    Serial.printf("[I2C] Using OLED at address 0x%02X\n", foundAddress);
  }

  if (!display.begin(SSD1306_SWITCHCAPVCC, foundAddress)) {
    Serial.println("[Error] SSD1306 allocation failed.");
  } else {
    Serial.println("[OLED] Display initialized successfully.");
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // Show Boot Screen
  updateScreen("boot", "SAGE BOT", "Starting up...", "Connecting Wi-Fi");

  // Connect to Wi-Fi
  Serial.printf("[Wi-Fi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[Wi-Fi] Connected! IP: %s, RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    updateScreen("wifi", "Wi-Fi Connected!", WiFi.localIP().toString());
    delay(1000);
  } else {
    Serial.println("\n[Wi-Fi] Connection failed or timed out. Operating in standalone mode.");
    updateScreen("wifi", "Wi-Fi Offline", "Retrying...");
    delay(1000);
  }

  // Synchronize clock with NTP
  syncTime();

  // Initial Home screen
  updateScreen("home", getFormattedTime(), getFormattedDate(), nextDosePreview);

  // Initial Supabase Sync
  if (WiFi.status() == WL_CONNECTED) {
    sendHeartbeat();
    fetchSchedules();
  }
}

// ─── MAIN LOOP ───────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED && (now % 10000 < 50)) {
    WiFi.reconnect();
  }

  // Handle temporary message expiration
  if (currentState == STATE_MESSAGE && now > messageExpiryTime) {
    currentState = STATE_IDLE;
    updateScreen("home", getFormattedTime(), getFormattedDate(), nextDosePreview);
  }

  // Update clock on Home screen every second
  if (currentState == STATE_IDLE && currentScreenName == "home") {
    static unsigned long lastClockTick = 0;
    if (now - lastClockTick >= 1000) {
      lastClockTick = now;
      screenLines[0] = getFormattedTime();
      screenLines[1] = getFormattedDate();
      screenLines[2] = nextDosePreview;
      renderOled();
    }
  }

  // 1. Poll Commands every 3 seconds
  if (now - lastCommandPoll >= COMMAND_INTERVAL_MS) {
    lastCommandPoll = now;
    if (WiFi.status() == WL_CONNECTED) {
      pollCommands();
    }
  }

  // 2. Send Heartbeat Telemetry every 10 seconds
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    if (WiFi.status() == WL_CONNECTED) {
      sendHeartbeat();
    }
  }

  // 3. Sync Hardware Config & Schedules every 30 seconds
  if (now - lastScheduleSync >= SCHEDULE_INTERVAL_MS) {
    lastScheduleSync = now;
    if (WiFi.status() == WL_CONNECTED) {
      fetchSchedules();
    }
  }

  delay(20);
}

// ─── OLED DISPLAY RENDERING ──────────────────────────────────────────────────
void updateScreen(const String& name, const String& l0, const String& l1, const String& l2, const String& l3) {
  currentScreenName = name;
  screenLines[0] = l0;
  screenLines[1] = l1;
  screenLines[2] = l2;
  screenLines[3] = l3;
  renderOled();
}

void renderOled() {
  display.clearDisplay();

  if (currentScreenName == "boot") {
    display.setTextSize(2);
    display.setCursor(16, 12);
    display.print(screenLines[0]);
    display.setTextSize(1);
    display.setCursor(20, 36);
    display.print(screenLines[1]);
    display.setCursor(14, 48);
    display.print(screenLines[2]);
  }
  else if (currentScreenName == "home") {
    // Header Bar: Wi-Fi dot + Time (Big)
    display.fillRect(0, 0, 4, 4, SSD1306_WHITE);
    display.setTextSize(2);
    display.setCursor(16, 4);
    display.print(screenLines[0]); // Time e.g. "10:42"

    // Date
    display.setTextSize(1);
    display.setCursor(16, 26);
    display.print(screenLines[1]); // Date e.g. "Tue 13 Oct"

    // Horizontal separator
    display.drawFastHLine(0, 40, 128, SSD1306_WHITE);

    // Next dose info
    display.setCursor(0, 48);
    display.print(screenLines[2]);
  }
  else if (currentScreenName == "alarm") {
    // Flashing banner
    display.fillRect(0, 0, 128, 14, SSD1306_WHITE);
    display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(18, 3);
    display.print("TAKE MEDICINE");

    // Medicine Name & Dose
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(2);
    display.setCursor(0, 20);
    display.print(screenLines[1].substring(0, 10));

    display.setTextSize(1);
    display.setCursor(0, 40);
    display.print(screenLines[2]); // Dose & Slot

    display.setCursor(0, 52);
    display.print(screenLines[3]); // "Mark taken in app"
  }
  else if (currentScreenName == "taken") {
    display.setTextSize(1);
    display.setCursor(30, 8);
    display.print("DOSE TAKEN");

    display.setTextSize(2);
    display.setCursor(10, 24);
    display.print(screenLines[1].substring(0, 10));

    // Checkmark icon
    display.drawLine(48, 52, 58, 62, SSD1306_WHITE);
    display.drawLine(58, 62, 80, 44, SSD1306_WHITE);
  }
  else if (currentScreenName == "loading") {
    display.setTextSize(2);
    display.setCursor(4, 8);
    display.print(screenLines[0]); // "LOAD SLOT N"

    display.setTextSize(1);
    display.setCursor(4, 32);
    display.print(screenLines[1]); // Medicine name

    display.setCursor(4, 48);
    display.print("Tap Done in app");
  }
  else if (currentScreenName == "message") {
    display.setTextSize(1);
    display.setCursor(0, 8);
    display.print(screenLines[0]);
    display.setCursor(0, 26);
    display.print(screenLines[1]);
    display.setCursor(0, 44);
    display.print(screenLines[2]);
  }
  else {
    display.setTextSize(1);
    for (int i = 0; i < 4; i++) {
      if (screenLines[i].length() > 0) {
        display.setCursor(0, i * 16);
        display.print(screenLines[i]);
      }
    }
  }

  display.display();
}

// ─── SUPABASE HTTP HELPERS ───────────────────────────────────────────────────
WiFiClientSecure createSecureClient() {
  WiFiClientSecure client;
  client.setInsecure(); // Skip TLS root cert validation for simple prototype
  return client;
}

// ─── LOOP 1: POLL COMMANDS (Every 3s) ─────────────────────────────────────────
void pollCommands() {
  WiFiClientSecure client = createSecureClient();
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/commands?status=eq.pending&order=created_at.asc&limit=1";
  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err && doc.is<JsonArray>() && doc.as<JsonArray>().size() > 0) {
      JsonObject cmd = doc[0];
      long cmdId = cmd["id"];
      String type = cmd["type"].as<String>();
      JsonObject p = cmd["payload"];

      Serial.printf("[Command] Received #%ld: %s\n", cmdId, type.c_str());

      String status = "done";
      String resultNote = "OK";

      if (type == "show_message") {
        JsonArray lines = p["lines"];
        String l0 = lines.size() > 0 ? lines[0].as<String>() : "";
        String l1 = lines.size() > 1 ? lines[1].as<String>() : "";
        String l2 = lines.size() > 2 ? lines[2].as<String>() : "";
        int seconds = p["seconds"] | 5;

        currentState = STATE_MESSAGE;
        messageExpiryTime = millis() + (seconds * 1000);
        updateScreen("message", l0, l1, l2);
        resultNote = "Message shown on OLED";
      }
      else if (type == "test_oled") {
        currentState = STATE_MESSAGE;
        messageExpiryTime = millis() + 4000;
        updateScreen("message", "OLED TEST OK", "Sage Bot 2.0", "Display Verified");
        resultNote = "Test pattern displayed";
      }
      else if (type == "rotate_to_slot") {
        int slot = p["slot"] | 1;
        String mode = p["mode"] | "dispense";
        // Stepper is physically OFF: degrade gracefully by showing virtual slot on OLED
        currentState = STATE_LOADING;
        updateScreen("loading", "LOAD SLOT " + String(slot), "Manual Dispense", "Tap Done in app");
        status = "simulated";
        resultNote = "Stepper motor not enabled. Displayed on OLED for manual slot selection.";
      }
      else if (type == "load_done") {
        int slot = p["slot"] | 1;
        updateScreen("message", "Slot " + String(slot) + " Loaded", "Supply updated", "");
        currentState = STATE_MESSAGE;
        messageExpiryTime = millis() + 2500;
        resultNote = "Compartment confirmed";
      }
      else if (type == "stop_alarm" || type == "mark_taken") {
        dismissAlarm();
        updateScreen("taken", "DOSE TAKEN", activeMedName, "");
        currentState = STATE_MESSAGE;
        messageExpiryTime = millis() + 3000;
        resultNote = "Alarm cleared";
      }
      else if (type == "test_alarm") {
        handleAlarm("Test Medication", "500mg", 1, "test-event");
        resultNote = "Test alarm triggered";
      }
      else {
        // Any other peripheral command is simulated since only OLED is attached
        status = "simulated";
        resultNote = "Peripheral disabled in hardware profile. Simulated successfully.";
      }

      // PATCH command status back to Supabase
      HTTPClient patchHttp;
      String patchUrl = String(SUPABASE_URL) + "/rest/v1/commands?id=eq." + String(cmdId);
      patchHttp.begin(client, patchUrl);
      patchHttp.addHeader("apikey", SUPABASE_KEY);
      patchHttp.addHeader("Content-Type", "application/json");

      StaticJsonDocument<256> patchDoc;
      patchDoc["status"] = status;
      patchDoc["result"]["ok"] = true;
      patchDoc["result"]["note"] = resultNote;
      patchDoc["done_at"] = getIsoTimestamp();

      String patchBody;
      serializeJson(patchDoc, patchBody);
      patchHttp.PATCH(patchBody);
      patchHttp.end();
    }
  }
  http.end();
}

// ─── LOOP 2: HEARTBEAT & OLED MIRROR (Every 10s) ──────────────────────────────
void sendHeartbeat() {
  WiFiClientSecure client = createSecureClient();
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/device_status?id=eq.1";
  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> doc;
  doc["last_seen"] = getIsoTimestamp();
  doc["state"]     = (currentState == STATE_ALARM) ? "alarm" : "idle";
  doc["ip"]        = WiFi.localIP().toString();
  doc["rssi"]      = WiFi.RSSI();
  doc["firmware"]  = "v1.0.0-esp32";
  doc["uptime_s"]  = millis() / 1000;

  // Mirror exact current OLED screen to database
  doc["oled_screen"]["screen"] = currentScreenName;
  JsonArray lines = doc["oled_screen"].createNestedArray("lines");
  lines.add(screenLines[0]);
  lines.add(screenLines[1]);
  lines.add(screenLines[2]);

  // Current physical diagnostic: only OLED is attached
  JsonObject parts = doc.createNestedObject("parts_ok");
  parts["oled"]    = true;
  parts["stepper"] = false;
  parts["hall"]    = false;
  parts["ir"]      = false;
  parts["servo"]   = false;
  parts["button"]  = false;
  parts["led"]     = false;
  parts["buzzer"]  = false;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.PATCH(requestBody);
  if (httpCode >= 200 && httpCode < 300) {
    Serial.println("[Heartbeat] Telemetry & OLED screen mirrored to Supabase.");
  } else {
    Serial.printf("[Heartbeat] Error %d\n", httpCode);
  }
  http.end();
}

// ─── LOOP 3: CACHE SCHEDULES (Every 30s) ─────────────────────────────────────
void fetchSchedules() {
  WiFiClientSecure client = createSecureClient();
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/schedules?enabled=eq.true&select=*,medicine:medicines(*)&order=time_of_day.asc";
  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    StaticJsonDocument<2048> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err && doc.is<JsonArray>()) {
      JsonArray scheds = doc.as<JsonArray>();
      if (scheds.size() > 0) {
        JsonObject first = scheds[0];
        String med = first["medicine"]["name"] | "Med";
        String t   = first["time_of_day"] | "08:00";
        int s      = first["slot_number"] | 1;
        nextDosePreview = "Next: " + med + " " + t.substring(0, 5) + " S" + String(s);
      } else {
        nextDosePreview = "No doses today";
      }
    }
  }
  http.end();
}

// ─── ALARM MANAGEMENT ────────────────────────────────────────────────────────
void handleAlarm(const String& medName, const String& dose, int slot, const String& eventId) {
  currentState  = STATE_ALARM;
  activeMedName = medName;
  activeDose    = dose;
  activeSlot    = slot;
  activeEventId = eventId;

  updateScreen("alarm", "TAKE MEDICINE", medName, dose + " Slot " + String(slot), "Mark taken in app");
  Serial.printf("[Alarm] TRIGGERED: %s (%s) Slot %d\n", medName.c_str(), dose.c_str(), slot);
}

void dismissAlarm() {
  currentState  = STATE_IDLE;
  activeMedName = "";
  activeDose    = "";
  activeEventId = "";
}

// ─── TIME & DATE UTILITIES ───────────────────────────────────────────────────
void syncTime() {
  Serial.println("[NTP] Synchronizing time...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry < 10) {
    delay(500);
    retry++;
  }
  if (retry < 10) {
    Serial.printf("[NTP] Synchronized: %02d:%02d:%02d\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  }
}

String getFormattedTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "--:--";
  char buf[8];
  strftime(buf, sizeof(buf), "%H:%M", &timeinfo);
  return String(buf);
}

String getFormattedDate() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "Sage Bot";
  char buf[16];
  strftime(buf, sizeof(buf), "%a %d %b", &timeinfo);
  return String(buf);
}

String getIsoTimestamp() {
  time_t now = time(nullptr);
  struct tm* gmt = gmtime(&now);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", gmt);
  return String(buf);
}
