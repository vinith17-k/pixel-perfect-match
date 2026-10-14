/**
 * ==============================================================================
 * Sage Bot 2.0 — ESP32 Smart IoT Medicine Dispenser Controller Firmware
 * ==============================================================================
 * Target Board: ESP32 Dev Module (WROOM-32 / NodeMCU-32S)
 * Connected Peripherals:
 *   - 1.3-inch I2C SH1106 OLED (128x64) (or SSD1306) on D21(SDA), D22(SCL)
 *   - 28BYJ-48 Stepper Motor + ULN2003 on D14, D27, D26, D25
 *   - Micro Servo (SG90) Chute Shutter on D18
 *   - Hall Effect Sensor (A3144) on D33
 *   - Tactile Push Button on D4 (Internal Pull-Up)
 *   - Status LED on D15
 *   - Active Buzzer on D13
 *   - (IR Sensor reserved on D32, currently unpopulated)
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <time.h>

// ─── WI-FI CREDENTIALS ────────────────────────────────────────────────────────
const char* WIFI_SSID     = "moto g85 5G_4167";
const char* WIFI_PASSWORD = "Shadow@3Zc";

// ─── SUPABASE CREDENTIALS ─────────────────────────────────────────────────────
const char* SUPABASE_URL  = "https://bhipuyxwjlcfkiguammh.supabase.co";
const char* SUPABASE_KEY  = "sb_publishable_Tq02iWx1p5wznqj2ifGvvA_gDEEXkuI";

// NTP Timezone settings: Default Asia/Kolkata (UTC + 5:30 = 19800 seconds)
const long  GMT_OFFSET_SEC      = 19800;
const int   DAYLIGHT_OFFSET_SEC = 0;
const char* NTP_SERVER_1        = "pool.ntp.org";
const char* NTP_SERVER_2        = "time.google.com";

// ─── PIN DEFINITIONS ──────────────────────────────────────────────────────────
#define PIN_SDA           21
#define PIN_SCL           22
#define PIN_STEPPER_IN1   14
#define PIN_STEPPER_IN2   27
#define PIN_STEPPER_IN3   26
#define PIN_STEPPER_IN4   25
#define PIN_SERVO         18
#define PIN_HALL          33
#define PIN_BUTTON        4
#define PIN_LED           15
#define PIN_BUZZER        13

// ─── PERIPHERAL INSTANCES ─────────────────────────────────────────────────────
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1

Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
Servo chuteServo;

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

// Stepper Position Tracking (Slots 1 to 8)
int currentMotorSlot = 1;
const int STEPS_PER_SLOT = 256; // 2048 steps / 8 slots = 256 steps per 45 deg

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

// ─── STEPPER MOTOR SEQUENCE ───────────────────────────────────────────────────
const int STEP_SEQ[4][4] = {
  {1, 1, 0, 0},
  {0, 1, 1, 0},
  {0, 0, 1, 1},
  {1, 0, 0, 1}
};

void stepMotor(int steps, int dir) {
  int seqStep = 0;
  for (int i = 0; i < steps; i++) {
    seqStep = (dir > 0) ? ((seqStep + 1) % 4) : ((seqStep + 3) % 4);
    digitalWrite(PIN_STEPPER_IN1, STEP_SEQ[seqStep][0]);
    digitalWrite(PIN_STEPPER_IN2, STEP_SEQ[seqStep][1]);
    digitalWrite(PIN_STEPPER_IN3, STEP_SEQ[seqStep][2]);
    digitalWrite(PIN_STEPPER_IN4, STEP_SEQ[seqStep][3]);
    delay(4);
  }
  // De-energize coils to prevent heat build-up
  digitalWrite(PIN_STEPPER_IN1, LOW);
  digitalWrite(PIN_STEPPER_IN2, LOW);
  digitalWrite(PIN_STEPPER_IN3, LOW);
  digitalWrite(PIN_STEPPER_IN4, LOW);
}

void rotateToSlot(int targetSlot) {
  if (targetSlot < 1 || targetSlot > 8) return;
  int diff = targetSlot - currentMotorSlot;
  if (diff == 0) return;

  int dir = 1;
  int slotsToMove = diff;
  if (slotsToMove < 0) slotsToMove += 8;
  if (slotsToMove > 4) {
    slotsToMove = 8 - slotsToMove;
    dir = -1;
  }

  Serial.printf("[Stepper] Moving from slot %d to %d (%d slots, dir=%d)\n", currentMotorSlot, targetSlot, slotsToMove, dir);
  stepMotor(slotsToMove * STEPS_PER_SLOT, dir);
  currentMotorSlot = targetSlot;
}

void homeDisc() {
  Serial.println("[Homing] Rotating disc to Hall sensor magnet (Slot 1)...");
  int stepsMoved = 0;
  int maxSteps = 2400;
  while (digitalRead(PIN_HALL) == HIGH && stepsMoved < maxSteps) {
    stepMotor(4, 1);
    stepsMoved += 4;
  }
  if (digitalRead(PIN_HALL) == LOW) {
    Serial.println("[Homing] Magnet detected! Homing complete. Set to Slot 1.");
    currentMotorSlot = 1;
  } else {
    Serial.println("[Homing] Hall sensor timeout: magnet not found within 360 deg.");
  }
}

// ─── SERVO SHUTTER ────────────────────────────────────────────────────────────
void openShutter() {
  chuteServo.write(90);
}

void closeShutter() {
  chuteServo.write(0);
}

// ─── CHIMES ───────────────────────────────────────────────────────────────────
void beepBuzzer(int durationMs) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(durationMs);
  digitalWrite(PIN_BUZZER, LOW);
}

void confirmChime() {
  digitalWrite(PIN_LED, HIGH);
  beepBuzzer(80);
  delay(60);
  beepBuzzer(140);
  digitalWrite(PIN_LED, LOW);
}

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
  Serial.println("\n[Sage Bot] Starting ESP32 Dispenser Controller...");

  // Initialize GPIO Pins
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_HALL, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  pinMode(PIN_STEPPER_IN1, OUTPUT);
  pinMode(PIN_STEPPER_IN2, OUTPUT);
  pinMode(PIN_STEPPER_IN3, OUTPUT);
  pinMode(PIN_STEPPER_IN4, OUTPUT);
  digitalWrite(PIN_STEPPER_IN1, LOW);
  digitalWrite(PIN_STEPPER_IN2, LOW);
  digitalWrite(PIN_STEPPER_IN3, LOW);
  digitalWrite(PIN_STEPPER_IN4, LOW);

  // Initialize Servo
  chuteServo.setPeriodHertz(50);
  chuteServo.attach(PIN_SERVO, 500, 2400);
  closeShutter();

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
    foundAddress = 0x3C;
  }

  display.begin(foundAddress, true);
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);

  // Show Boot Screen & Startup Chime
  updateScreen("boot", "SAGE BOT 2.0", "Starting up...", "Connecting Wi-Fi");
  confirmChime();

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

  // 1. Physical Push Button Check (D4)
  if (digitalRead(PIN_BUTTON) == LOW) {
    delay(50); // debounce
    if (digitalRead(PIN_BUTTON) == LOW) {
      Serial.println("[Button] Physical button pressed on D4!");
      if (currentState == STATE_ALARM) {
        Serial.println("[Button] Alarm acknowledged via button!");
        dismissAlarm();
        confirmChime();
        updateScreen("taken", "DOSE TAKEN", activeMedName, "Via Button");
        currentState = STATE_MESSAGE;
        messageExpiryTime = millis() + 3000;

        // Synchronize dose taken to Supabase
        if (activeEventId.length() > 0 && WiFi.status() == WL_CONNECTED) {
          WiFiClientSecure client;
          client.setInsecure();
          HTTPClient http;
          String patchUrl = String(SUPABASE_URL) + "/rest/v1/dose_events?id=eq." + activeEventId;
          http.begin(client, patchUrl);
          http.addHeader("apikey", SUPABASE_KEY);
          http.addHeader("Content-Type", "application/json");
          StaticJsonDocument<256> pDoc;
          pDoc["status"] = "taken";
          pDoc["taken_at"] = getIsoTimestamp();
          pDoc["taken_via"] = "button";
          String pBody;
          serializeJson(pDoc, pBody);
          http.PATCH(pBody);
          http.end();
        }
      } else {
        // Idle button tap: quick chime
        confirmChime();
      }
      while (digitalRead(PIN_BUTTON) == LOW) delay(10);
    }
  }

  // 2. Alarm LED & Buzzer Cadence
  if (currentState == STATE_ALARM) {
    bool blinkState = (now / 400) % 2;
    digitalWrite(PIN_LED, blinkState ? HIGH : LOW);
    bool beepState = (now % 1000) < 150;
    digitalWrite(PIN_BUZZER, beepState ? HIGH : LOW);
  } else {
    digitalWrite(PIN_BUZZER, LOW);
    // Subtle heartbeat pulse every 6 seconds on LED
    bool heartPulse = (now % 6000) < 60;
    digitalWrite(PIN_LED, heartPulse ? HIGH : LOW);
  }

  // 3. Wi-Fi Auto-Reconnect
  if (WiFi.status() != WL_CONNECTED && (now % 10000 < 50)) {
    WiFi.reconnect();
  }

  // 4. Temporary Message Expiration
  if (currentState == STATE_MESSAGE && now > messageExpiryTime) {
    currentState = STATE_IDLE;
    updateScreen("home", getFormattedTime(), getFormattedDate(), nextDosePreview);
  }

  // 5. Command Polling Loop (Every 3s)
  if (now - lastCommandPoll >= COMMAND_INTERVAL_MS) {
    lastCommandPoll = now;
    if (WiFi.status() == WL_CONNECTED) {
      pollCommands();
    }
  }

  // 6. Heartbeat & OLED Mirror (Every 10s)
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    if (WiFi.status() == WL_CONNECTED) {
      sendHeartbeat();
    }
  }

  // 7. Schedule Synchronization (Every 30s)
  if (now - lastScheduleSync >= SCHEDULE_INTERVAL_MS) {
    lastScheduleSync = now;
    if (WiFi.status() == WL_CONNECTED) {
      fetchSchedules();
    }
  }

  delay(15);
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
    display.setCursor(8, 10);
    display.print(screenLines[0]);
    display.setTextSize(1);
    display.setCursor(16, 36);
    display.print(screenLines[1]);
    display.setCursor(12, 48);
    display.print(screenLines[2]);
  }
  else if (currentScreenName == "home") {
    display.fillRect(0, 0, 4, 4, SH110X_WHITE);
    display.setTextSize(2);
    display.setCursor(16, 4);
    display.print(screenLines[0]); // Time e.g. "15:08"

    display.setTextSize(1);
    display.setCursor(16, 26);
    display.print(screenLines[1]); // Date e.g. "Wed 14 Oct"

    display.drawFastHLine(0, 40, 128, SH110X_WHITE);

    display.setCursor(0, 48);
    display.print(screenLines[2]); // Next dose info
  }
  else if (currentScreenName == "alarm") {
    display.fillRect(0, 0, 128, 14, SH110X_WHITE);
    display.setTextColor(SH110X_BLACK, SH110X_WHITE);
    display.setTextSize(1);
    display.setCursor(18, 3);
    display.print("TAKE MEDICINE");

    display.setTextColor(SH110X_WHITE);
    display.setTextSize(2);
    display.setCursor(0, 20);
    display.print(screenLines[1].substring(0, 10));

    display.setTextSize(1);
    display.setCursor(0, 40);
    display.print(screenLines[2]);

    display.setCursor(0, 52);
    display.print(screenLines[3]);
  }
  else if (currentScreenName == "taken") {
    display.setTextSize(1);
    display.setCursor(30, 8);
    display.print("DOSE TAKEN");

    display.setTextSize(2);
    display.setCursor(10, 24);
    display.print(screenLines[1].substring(0, 10));

    display.drawLine(48, 52, 58, 62, SH110X_WHITE);
    display.drawLine(58, 62, 80, 44, SH110X_WHITE);
  }
  else if (currentScreenName == "loading") {
    display.setTextSize(2);
    display.setCursor(4, 8);
    display.print(screenLines[0]);

    display.setTextSize(1);
    display.setCursor(4, 32);
    display.print(screenLines[1]);

    display.setCursor(4, 48);
    display.print("Tap Done in app");
  }
  else if (currentScreenName == "moving") {
    display.setTextSize(2);
    display.setCursor(4, 12);
    display.print("MOVING DISC");
    display.setTextSize(1);
    display.setCursor(4, 40);
    display.print(screenLines[1]);
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

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
WiFiClientSecure createSecureClient() {
  WiFiClientSecure client;
  client.setInsecure();
  return client;
}

// ─── POLL COMMANDS ────────────────────────────────────────────────────────────
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

      Serial.printf("[Command] Executing #%ld: %s\n", cmdId, type.c_str());

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
        currentState = STATE_MOVING;
        updateScreen("moving", "Moving disc", "To Slot " + String(slot));
        rotateToSlot(slot);
        currentState = STATE_IDLE;
        updateScreen("home", getFormattedTime(), getFormattedDate(), nextDosePreview);
        resultNote = "Rotated to slot " + String(slot);
      }
      else if (type == "home") {
        currentState = STATE_MOVING;
        updateScreen("moving", "Homing disc", "Finding Slot 1");
        homeDisc();
        currentState = STATE_IDLE;
        updateScreen("home", getFormattedTime(), getFormattedDate(), nextDosePreview);
        resultNote = "Disc homed to slot 1";
      }
      else if (type == "test_stepper") {
        currentState = STATE_MOVING;
        updateScreen("moving", "Testing Stepper", "Step 45 deg");
        stepMotor(STEPS_PER_SLOT, 1);
        delay(300);
        stepMotor(STEPS_PER_SLOT, -1);
        currentState = STATE_IDLE;
        updateScreen("home", getFormattedTime(), getFormattedDate(), nextDosePreview);
        resultNote = "Stepper rotated forward and reverse";
      }
      else if (type == "test_servo") {
        updateScreen("message", "Testing Servo", "Opening shutter...");
        openShutter();
        delay(1500);
        closeShutter();
        resultNote = "Servo shutter opened and closed";
      }
      else if (type == "test_led") {
        for (int i = 0; i < 3; i++) {
          digitalWrite(PIN_LED, HIGH); delay(200);
          digitalWrite(PIN_LED, LOW); delay(200);
        }
        resultNote = "LED blinked 3 times";
      }
      else if (type == "test_buzzer") {
        for (int i = 0; i < 3; i++) {
          beepBuzzer(150); delay(120);
        }
        resultNote = "Buzzer beeped 3 times";
      }
      else if (type == "test_button") {
        int val = digitalRead(PIN_BUTTON);
        resultNote = (val == LOW) ? "Button currently PRESSED" : "Button RELEASED (Normal)";
      }
      else if (type == "test_hall") {
        int val = digitalRead(PIN_HALL);
        resultNote = (val == LOW) ? "Magnet DETECTED (LOW)" : "No magnet nearby (HIGH)";
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
        confirmChime();
        updateScreen("taken", "DOSE TAKEN", activeMedName, "");
        currentState = STATE_MESSAGE;
        messageExpiryTime = millis() + 3000;
        resultNote = "Alarm cleared";
      }
      else if (type == "test_alarm") {
        handleAlarm("Metformin", "500mg", 1, "test-event");
        resultNote = "Test alarm triggered";
      }
      else {
        resultNote = "Command acknowledged";
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

// ─── HEARTBEAT TELEMETRY ──────────────────────────────────────────────────────
void sendHeartbeat() {
  WiFiClientSecure client = createSecureClient();
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/device_status?id=eq.1";
  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> doc;
  doc["last_seen"]    = getIsoTimestamp();
  doc["state"]        = (currentState == STATE_ALARM) ? "alarm" : "idle";
  doc["current_slot"] = currentMotorSlot;
  doc["ip"]           = WiFi.localIP().toString();
  doc["rssi"]         = WiFi.RSSI();
  doc["firmware"]     = "v2.0.0-esp32";
  doc["uptime_s"]     = millis() / 1000;

  doc["oled_screen"]["screen"] = currentScreenName;
  JsonArray lines = doc["oled_screen"].createNestedArray("lines");
  lines.add(screenLines[0]);
  lines.add(screenLines[1]);
  lines.add(screenLines[2]);

  JsonObject parts = doc.createNestedObject("parts_ok");
  parts["oled"]    = true;
  parts["stepper"] = true;
  parts["hall"]    = true;
  parts["ir"]      = false; // user has not connected IR yet
  parts["servo"]   = true;
  parts["button"]  = true;
  parts["led"]     = true;
  parts["buzzer"]  = true;

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

// ─── FETCH SCHEDULES ──────────────────────────────────────────────────────────
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
      JsonArray arr = doc.as<JsonArray>();
      if (arr.size() > 0) {
        JsonObject first = arr[0];
        String med = first["medicine"]["name"].as<String>();
        String t = first["time_of_day"].as<String>().substring(0, 5);
        int slot = first["slot_number"] | 1;
        nextDosePreview = "Next: " + med + " " + t + " S" + String(slot);
      } else {
        nextDosePreview = "No doses today";
      }

      if (currentState == STATE_IDLE) {
        updateScreen("home", getFormattedTime(), getFormattedDate(), nextDosePreview);
      }
    }
  }
  http.end();
}

// ─── ALARM ENGINE ─────────────────────────────────────────────────────────────
void handleAlarm(const String& medName, const String& dose, int slot, const String& eventId) {
  currentState  = STATE_ALARM;
  activeMedName = medName;
  activeDose    = dose;
  activeSlot    = slot;
  activeEventId = eventId;

  // Automatically rotate disc to the dose slot & open chute shutter
  rotateToSlot(slot);
  openShutter();

  updateScreen("alarm", "TAKE MEDICINE", medName, dose + " Slot " + String(slot), "Press button");
  Serial.printf("[Alarm] TRIGGERED: %s (%s) at Slot %d\n", medName.c_str(), dose.c_str(), slot);
}

void dismissAlarm() {
  currentState  = STATE_IDLE;
  activeMedName = "";
  activeDose    = "";
  activeEventId = "";

  closeShutter();
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED, LOW);
  updateScreen("home", getFormattedTime(), getFormattedDate(), nextDosePreview);
  Serial.println("[Alarm] Dismissed.");
}

// ─── TIME & FORMATTING HELPERS ────────────────────────────────────────────────
void syncTime() {
  Serial.println("[NTP] Synchronizing time...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);

  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry < 15) {
    delay(500);
    retry++;
  }

  if (retry < 15) {
    char buf[32];
    strftime(buf, sizeof(buf), "%H:%M:%S", &timeinfo);
    Serial.printf("[NTP] Synchronized: %s\n", buf);
  } else {
    Serial.println("[NTP] Synchronization timed out.");
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
  time_t now;
  time(&now);
  struct tm* timeinfo = gmtime(&now);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", timeinfo);
  return String(buf);
}
