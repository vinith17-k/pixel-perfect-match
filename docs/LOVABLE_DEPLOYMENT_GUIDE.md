# Lovable Deployment Guide

This guide details how to recreate, deploy, and manage the **Sage Bot 2.0** application using **Lovable** and **Supabase**.

---

## 📋 Step-by-Step Deployment Workflow

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Under **Project Settings &rarr; API**, copy your:
   - **Project URL** (`https://<project-ref>.supabase.co`)
   - **anon public key** (`eyJ...`)
3. Open the **SQL Editor** in Supabase and paste the contents of [`supabase/migrations/001_init.sql`](../supabase/migrations/001_init.sql). Run the query to establish all 7 tables, policies, and realtime publications.

---

### Step 2: Initialize Lovable
1. Go to [lovable.dev](https://lovable.dev) and start a new project.
2. Click on the **Supabase** icon in Lovable’s left-hand toolbar to connect your project. Provide your project URL and anon API key (or use Lovable’s one-click connect integration).

---

### Step 3: Lovable Master Prompt
Copy and paste this prompt directly into Lovable:

```text
Build a smart medicine reminder and dispenser web app called "Sage Bot" with a Supabase backend. The website controls and monitors an IoT physical dispenser device (ESP32) through Supabase tables, and includes a built-in virtual device simulator when the hardware is offline.

Design & Layout:
- Industrial tactile hardware enclosure shell with Space Grotesk & Space Mono typography.
- Top centered USB-C port indicator with a status LED.
- 4 metallic corner screws on the chassis.
- Header: Sage Bot spinning capsule logo, device name, speaker grille, Online/Offline badge, and Theme toggle.
- Hardware parts status chip row: "N of 8 parts ON" + 8 chips (OLED, Stepper, Hall, IR, Servo, Button, LED, Buzzer).
- Bottom floating navigation bar: Tabs for [Today, Slots, Schedule, History, Hardware, Settings] (keyboard shortcuts: 1-6 for tabs, T for theme).
- Floating Due Bar: When an alarm is active and user is on another page, an amber alert bar appears above the bottom nav with [Take] and [Snooze] buttons.

Database & Realtime:
- Use Supabase tables: medicines, slots (1-8), schedules, dose_events, commands, hardware_config (id=1), device_status (id=1).
- Enable Realtime subscriptions across all tables with 5-second polling fallback.

Hardware Profile & Graceful Degradation:
- Default: OLED = ON, all other 7 parts = OFF.
- Stepper OFF: "Rotate to slot" commands are marked simulated. OLED displays "LOAD SLOT N" or "TAKE SLOT N". UI shows "Virtual Slot" badge.
- Hall OFF: Homing skipped. Device assumes Slot 1 on boot.
- IR + Servo OFF: Flap shutter bypassed; alarm proceeds to waiting for taken.
- Button OFF: OLED displays "Mark taken in app"; web UI shows prominent "Mark as taken" button.
- LED / Buzzer OFF: Alerts continue visually without audio/light.
- OLED OFF: Alerts display in web app; preview card says "OLED disabled".

Pages:
1. Dashboard: Alarm banner (pulsing amber with Mark as taken, Snooze, Skip), Next dose card with countdown, Today's schedule timeline with status chips, Quick stats (adherence %, doses taken, low stock), live OLED preview bezel (128x64 display mirror with screen picker), quick actions, and Command Log drawer with stuck command detection (>20s).
2. Slots: Interactive circular SVG Rotor Disc with 8 pockets, rotate animation to dispense chute, slot cards, 3-step Add Medicine flow (rotate command -> medicine form -> load done), Refill, and Edit actions.
3. Schedule: List view grouped by slot and 7-day Week Grid view. Modal with loaded slot picker, time picker, day toggles, and collision warnings.
4. History: 14-day adherence bar chart (Recharts), radial adherence gauge, filterable table, and CSV export.
5. Hardware: Setup progress bar, 8 peripheral cards with pinout tables and live Test buttons, device self-report table, Home Disc button, and Developer Section with Supabase URL, anon key, and REST contract.
6. Settings: Device parameters, browser device simulator toggle, client PIN lock (4 digits), Demo data loader/clearer, and danger zone reset.

Simulator Engine:
- When Simulator Mode is ON: Emulate ESP32 in browser (heartbeat every 10s, process pending commands every 3s, fire scheduled dose_events, mark overdue as missed). Automatically turn off simulator if a real device checks in.
```

---

### Step 4: Verification Checklist in Lovable

Once Lovable finishes generating the code, verify the following:

- [ ] **OLED Preview**: Renders live data from `device_status.oled_screen`. The screen picker allows previewing all 10 states (boot, home, alarm, etc.).
- [ ] **Interactive Rotor Disc**: Clicking "Next Slot" or "Rotate Here" rotates the SVG disc smoothly into the top chute position.
- [ ] **Hardware Degradation**: Toggling Stepper OFF in Hardware changes rotation commands to `simulated` and adds the `Virtual Slot` badge.
- [ ] **Simulator Engine**: Turning Simulator ON in Settings updates the device to `Online` with firmware `simulator` and heartbeat every 10 seconds.
- [ ] **Demo Data**: Clicking "Load Demo Data" in Settings seeds 3 medicines, schedules, and 10 days of history.
- [ ] **Command Queue**: Dispatched commands appear in the Command Log drawer with status chips (`pending`, `done`, `simulated`).
