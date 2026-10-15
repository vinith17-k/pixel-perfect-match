# Sage Bot — Smart Medicine Reminder & Dispenser

Sage Bot is a web dashboard and an ESP32-connected medicine reminder prototype. The web app uses Supabase for authenticated access, storage, and realtime updates. A single owner account operates the app; a separate device account authenticates the ESP32.

## Features

- Medicine, slot inventory, dose schedule, and dose-history management.
- Dashboard telemetry and command queue for the ESP32.
- Browser-based device simulator for testing workflows.
- Owner-only Supabase access with separate device permissions.
- The currently supported physical peripherals are OLED, stepper motor, push button, LED, and buzzer.

Hall and IR sensors and the servo motor are intentionally not supported. Because no position sensor is installed, carousel position is only estimated from boot and must be aligned manually after a restart. The firmware does not execute schedules while offline; schedule data is currently fetched only to display a next-dose preview.

## Tech Stack

- React 19, TypeScript, Vite 8
- Tailwind CSS 3, Radix UI, Lucide
- Supabase JS and PostgreSQL
- Recharts; date-fns and date-fns-tz

## Setup

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 8) and npm
- A Supabase project

### Configure the web app

Copy `.env.example` to `.env` and set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Use the project's publishable/anon key only; never put a service-role key in the browser.

### Configure Supabase

1. In Supabase Authentication, create one owner user and one separate device user. Disable public sign-ups.
2. Run `supabase/migrations/001_init.sql`, then `supabase/migrations/002_secure_access_and_device_workflows.sql` in the SQL Editor. The first migration enables RLS without public policies; the second installs the authenticated owner/device policies.
3. In the SQL Editor, set the UUIDs from Authentication → Users:

   ```sql
   update public.app_access
   set owner_user_id = '<owner-user-uuid>',
       device_user_id = '<device-user-uuid>'
   where id = 1;
   ```

4. Sign in to the web app as the owner. The device's email and password are configured only in its ignored local `secrets.h`.

The sign-in screen does not include registration. A local PIN setting is only a convenience lock for that browser; Supabase authentication is the access control.

### Run

```sh
npm install
npm run dev
```

Use `npm test`, `npm run build`, and `npm run lint` to validate the web app.

## ESP32 Setup

The supported build is in `firmware/esp32_sage_bot/`. Copy `secrets.example.h` to `secrets.h` (the latter is git-ignored), then set the Wi-Fi SSID/password, Supabase URL and publishable key, and the device user's email/password. The firmware validates TLS using the included GlobalSign ECC Root CA - R4 certificate; do not disable certificate checks.

The ESP32 obtains and refreshes a Supabase Auth session, then uses the authenticated bearer token for REST and RPC requests. It atomically claims commands and reports completion through database RPCs. See [docs/ESP32_FIRMWARE_CONTRACT.md](./docs/ESP32_FIRMWARE_CONTRACT.md) for endpoints and current behavior.

### Supported wiring

| Part | ESP32 pins | Notes |
|---|---|---|
| I²C OLED | SDA `D21`, SCL `D22` | 3.3V logic; address `0x3C` |
| 28BYJ-48 + ULN2003 | IN1 `D14`, IN2 `D27`, IN3 `D26`, IN4 `D25` | Power motor from 5V/VIN |
| Push button | `D4` to GND | Internal pull-up |
| Status LED | `D15` | Use a 220Ω series resistor |
| Active buzzer | `D13` | Check polarity |

Do not use ESP32 GPIO `D12`; it is a strapping pin.

## Project Validation

The repository includes focused dose-RPC tests, a production build, and lint checks. Firmware requires Arduino-ESP32, ArduinoJson, Adafruit GFX, and Adafruit SH110X libraries; compile it with the matching Arduino toolchain after creating local `secrets.h`.

`Sage Bot (2).html` is a legacy standalone prototype and is not used by the Vite build or CI. The supported application is the React source described above.
