# Sage Bot 2.0 — ESP32 Firmware Guide

This directory contains the ready-to-flash Arduino firmware for the **ESP32 DevKit V1** connected to the **0.96-inch I²C SSD1306 OLED display**.

---

## 🔌 Hardware Wiring (OLED Only Setup)

| OLED Pin | ESP32 Pin | Function |
|---|---|---|
| **VCC** | **3V3** | 3.3V Logic & Power |
| **GND** | **GND** | Ground |
| **SDA** | **GPIO 21 (D21)** | I²C Data Line |
| **SCL** | **GPIO 22 (D22)** | I²C Clock Line |

*I²C address: `0x3C`.*

---

## 📦 Required Libraries (Arduino IDE)

Open **Arduino IDE &rarr; Tools &rarr; Manage Libraries...** and install:
1. **`Adafruit SSD1306`** (by Adafruit)
2. **`Adafruit GFX Library`** (by Adafruit)
3. **`ArduinoJson`** (v6 or v7 by Benoit Blanchon)

---

## ⚡ Flashing Instructions

1. Open [`esp32_sage_bot.ino`](esp32_sage_bot.ino) in Arduino IDE.
2. Update lines 32–33 with your local 2.4GHz Wi-Fi credentials:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   ```
3. Connect your ESP32 to your computer via USB.
4. In Arduino IDE, select:
   - **Board**: `ESP32 Dev Module` (or `DOIT ESP32 DEVKIT V1`)
   - **Port**: Select your ESP32 COM port
   - **Upload Speed**: `921600` (or `115200`)
5. Click **Upload** (arrow icon).

---

## 🔄 Live Web Sync Behavior

Once the ESP32 boots and connects to Wi-Fi:
1. **OLED Startup Screen**: Displays `SAGE BOT`, connects to Wi-Fi, syncs Indian Standard Time (IST) via NTP, and displays the `HOME` screen (`Time`, `Date`, and `Next dose`).
2. **Realtime Telemetry (10s)**: The ESP32 sends its IP, RSSI, and exact OLED screen text to Supabase.
3. **Automatic Simulator Stand-down**: The web dashboard detects the real ESP32 (`firmware: v1.0.0-esp32`) and automatically disables the browser simulator.
4. **Command Processing (3s)**:
   - Click **Test OLED** on the website &rarr; The physical OLED immediately displays the test pattern!
   - Click **Show message** on the website &rarr; Your custom message appears on the physical display!
   - Click **Rotate to slot** on the website &rarr; The physical OLED shows `LOAD SLOT N` for manual compartment selection!
   - When a dose is due &rarr; The physical OLED rings with `TAKE MEDICINE` and the dose details!
