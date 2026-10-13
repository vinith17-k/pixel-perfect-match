# Sage Bot — Smart Medicine Reminder & Dispenser

Sage Bot is a website-controlled smart medicine reminder and dispenser. A physical device (ESP32) is controlled and monitored by this web application via Supabase Realtime and PostgreSQL. The application is designed to operate with **any subset of hardware connected** (starting with just the 0.96-inch I²C OLED display) and gracefully degrades as additional components are attached.

---

## 🌟 Key Features

1. **Hardware Profile & Graceful Degradation**
   - Toggle switches for all 8 components: OLED, Stepper Motor, Hall Sensor, IR Sensor, Servo Shutter, Push Button, Status LED, and Buzzer.
   - Defaults: **OLED = ON**, all other peripherals = **OFF**.
   - Immediate graceful degradation without reflashing firmware:
     - **Stepper OFF**: "Rotate to slot" commands are marked simulated. The OLED shows `LOAD SLOT N` or `TAKE SLOT N` so the patient can pick the compartment manually. The UI displays a "Virtual Slot" badge.
     - **Hall Sensor OFF**: Homing is skipped. Disc assumes Slot 1 on boot. A warning chip appears if stepper is ON.
     - **IR Sensor + Servo OFF**: Flap shutter is bypassed; alarm transitions directly to "waiting for taken".
     - **Push Button OFF**: Device alerts indicate "Mark taken in app". The website presents a prominent "Mark as taken" action.
     - **LED / Buzzer OFF**: Skipped silently; OLED and web notifications persist.
     - **OLED OFF**: Alerts display in the web application (preview card shows "OLED disabled").

2. **Retro-Tactile Industrial UI**
   - Authentic hardware enclosure shell styling: Top USB-C port, corner chassis screws, speaker grille, live OLED bezel monitor with rotary encoder knob simulation, and interactive circular rotating SVG medicine rotor disc.
   - Dual light and dark modes with persistent theme toggle.
   - Responsive design with bottom tactile tab bar on mobile and expansive dashboard on desktop.

3. **Supabase Realtime Telemetry & Fallback Polling**
   - Realtime channel subscriptions on `device_status`, `commands`, `dose_events`, `slots`, `hardware_config`, `schedules`, and `medicines`.
   - Automatic 5-second fallback polling if WebSocket connections drop.

4. **Built-in Virtual Device Simulator**
   - Self-contained in-browser ESP32 simulator:
     - Emulates 10-second heartbeats (`device_status`).
     - Polls and resolves `pending` commands (`commands`) every 3 seconds.
     - Evaluates active schedules and fires `dose_events` at scheduled times.
     - Automatically shuts down if real ESP32 hardware is detected online.
     - Fast-forward button for instant alarm testing.

5. **Security & Data Safety**
   - Optional local 4-digit PIN lock screen stored locally in browser storage.
   - Demo data loader (Metformin, Vitamin D3, Amlodipine across 10 days with ~90% adherence) and full database reset utilities.

---

## 🛠️ Tech Stack

- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS 3, Radix UI Primitives, Lucide Icons, Space Grotesk & Space Mono typography
- **Data & Realtime**: Supabase (`@supabase/supabase-js`)
- **Visuals & Charts**: Recharts, SVG Rotor Disc, Canvas Pixel Font OLED Emulator
- **Timezone**: date-fns, date-fns-tz (Default: `Asia/Kolkata`, timestamps in UTC)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) project

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```
Populate your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Database Migration
Open your Supabase project's **SQL Editor** and run the entire SQL migration located at:
```
supabase/migrations/001_init.sql
```
This script creates:
- `medicines`
- `slots` (initialized with 8 compartments)
- `schedules`
- `dose_events`
- `commands`
- `hardware_config` (single row `id = 1`)
- `device_status` (single row `id = 1`)
- Prototype Row-Level Security (RLS) policies for anonymous access
- Realtime publication subscriptions

### 4. Install Dependencies & Run
```bash
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 🔌 ESP32 Hardware Contract & Firmware Spec

The physical ESP32 connects to Supabase REST via HTTP PostgREST headers:
```http
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

### Polling & Telemetry Loops
1. **Every 3 seconds (Command Execution)**:
   - `GET /rest/v1/commands?status=eq.pending&order=created_at.asc`
   - Run command, then:
   - `PATCH /rest/v1/commands?id=eq.<id>` with body:
     ```json
     {
       "status": "done",
       "result": { "ok": true, "note": "motor rotated" },
       "done_at": "2026-10-13T08:30:00Z"
     }
     ```
2. **Every 10 seconds (Status Telemetry)**:
   - `PATCH /rest/v1/device_status?id=eq.1` with body:
     ```json
     {
       "last_seen": "2026-10-13T08:30:00Z",
       "state": "idle",
       "current_slot": 1,
       "ip": "192.168.1.105",
       "rssi": -55,
       "firmware": "v1.0.0-esp32",
       "uptime_s": 3600,
       "oled_screen": {
         "screen": "home",
         "lines": ["10:42", "Tue 13 Oct", "Next: Metformin 13:00 S3"]
       },
       "parts_ok": { "oled": true, "stepper": false }
     }
     ```
3. **Every 30 seconds (Cache Config & Schedules)**:
   - `GET /rest/v1/hardware_config?id=eq.1`
   - `GET /rest/v1/schedules?enabled=eq.true&select=*,medicine:medicines(*),slot:slots(*)`
   - *Device continues standalone alarms from cache if Wi-Fi drops.*
4. **On Alarm**:
   - `POST /rest/v1/dose_events` with status `due`.
   - Update to `taken`, `missed`, `snoozed`, or `skipped` when resolved.

---

## 📌 Wiring Reference

| Part | ESP32 Pins | Notes |
|---|---|---|
| **OLED 0.96" I²C** | SDA = `D21`, SCL = `D22`, VCC = `3V3`, GND = `GND` | Address 0x3C |
| **Stepper (ULN2003)** | IN1 = `D14`, IN2 = `D27`, IN3 = `D26`, IN4 = `D25`, + = `VIN (5V)`, - = `GND` | Motor 5-wire plug into driver |
| **Hall Sensor (A3144)** | OUT = `D33`, VCC = `VIN (5V)`, GND = `GND` | Magnet glued to Slot 1 |
| **IR Sensor (FC-51)** | OUT = `D32`, VCC = `3V3`, GND = `GND` | Chute proximity detection |
| **Servo (SG90)** | Signal = `D18`, Red = `VIN (5V)`, Brown = `GND` | 470µF cap across 5V and GND |
| **Push Button** | Leg A = `D4`, Opposite Leg = `GND` | Internal pull-up |
| **LED** | `D15` through 220Ω to Anode (long leg), Cathode to `GND` | Status indicator |
| **Active Buzzer** | + = `D13`, - = `GND` | Active 5V buzzer |
| **Warning** | **Do NOT use `D12`** | Strapping/boot mode pin |
