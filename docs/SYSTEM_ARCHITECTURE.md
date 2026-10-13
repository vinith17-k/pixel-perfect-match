# System Architecture & Technical Design

This document details the software architecture, state machines, and data pipelines of the **Sage Bot 2.0** ecosystem.

---

## 🏗️ Layered Architecture

```mermaid
graph TD
    subgraph UI_Layer["User Interface Layer (React 18 + Tailwind)"]
        Pages["Pages (Dashboard, Slots, Schedule, History, Hardware, Settings)"]
        Components["Enclosure Shell, OLED Preview, Rotor Disc SVG, Modals"]
    end

    subgraph State_Layer["State & Telemetry Layer"]
        AppStore["appStore (Theme, PIN, Tabs, Drawer)"]
        Hooks["Custom Hooks (useHardwareConfig, useDeviceStatus, useCommands, etc.)"]
        Sim["Simulator Service (Background Intervals)"]
    end

    subgraph Comm_Layer["Communication & Network Layer"]
        RealtimeClient["Supabase Realtime (WebSocket channels)"]
        RestClient["Supabase REST (Commands & State Mutations)"]
        Fallback["5-Second Heartbeat Polling Timer"]
    end

    subgraph Cloud_Layer["Cloud Database Layer (Supabase PostgreSQL)"]
        Tables["7 Tables (medicines, slots, schedules, dose_events, commands, config, status)"]
    end

    subgraph Hardware_Layer["Physical Layer (ESP32)"]
        ESP32["ESP32 Controller Loop"]
        Peripherals["OLED, Stepper, Hall, IR, Servo, Button, LED, Buzzer"]
    end

    Pages --> Components
    Pages --> Hooks
    Hooks --> AppStore
    Hooks --> RealtimeClient
    Hooks --> RestClient
    Hooks --> Fallback
    Sim <--> RestClient
    RealtimeClient <--> Tables
    RestClient <--> Tables
    ESP32 <--> RestClient
    ESP32 --> Peripherals
```

---

## 🔄 State Machines

### 1. Dose Event Lifecycle
Every dose originates from an enabled schedule and transitions through a deterministic state machine:

```mermaid
stateDiagram-v2
    [*] --> upcoming: Schedule created for future time
    upcoming --> due: Scheduled minute arrives (via ESP32 or Simulator)
    
    due --> taken: Button pressed OR Mark as taken in web app
    due --> snoozed: Snooze tapped (repeats after snooze_minutes)
    due --> skipped: Patient taps Skip
    due --> missed: missed_after_minutes elapsed without action
    
    snoozed --> due: snooze_until timestamp arrives
    
    taken --> [*]: Decrements slots.pills_remaining
    missed --> [*]: Recorded in adherence logs
    skipped --> [*]: Recorded in adherence logs
```

- **Pill Decrementing**: When an event transitions to `taken`, the system automatically decrements `slots.pills_remaining` by `pills_per_dose` exactly once. If the remaining count falls below `low_stock_threshold`, an alert toast is raised.

---

### 2. Command Pipeline Lifecycle
Outbound commands from the website to the physical device follow this pipeline:

```mermaid
stateDiagram-v2
    [*] --> pending: Website inserts into `commands` table
    
    pending --> running: ESP32 or Simulator fetches command
    pending --> failed: User clicks Cancel OR timeout exceeds threshold
    
    running --> done: Target hardware executed successfully
    running --> simulated: Target peripheral is disabled in `hardware_config`
    running --> failed: Hardware error or exception
    
    done --> [*]
    simulated --> [*]
    failed --> [*]
```

- **Stuck Detection**: If a command remains in `pending` or `running` state for longer than **20 seconds**, the UI flags `"Device not responding"` and provides **Retry** and **Cancel** controls.

---

## 🔌 Dual Controller Synchronization

Sage Bot operates with either physical hardware or a virtual simulator:

| Event | Physical ESP32 Present | In-Browser Simulator Active |
|---|---|---|
| **Heartbeat Frequency** | Updates `device_status` every 10s via HTTP PATCH. | Updates `device_status` every 10s via client timer. |
| **Firmware Identification** | Reports version (e.g. `v1.0.0-esp32`). | Reports firmware as `'simulator'`. |
| **Command Processing** | Polls every 3s; executes physical GPIO transitions. | Polls every 3s; simulates steps and writes result JSON. |
| **Schedule Triggering** | Evaluates local RTC/NTP time every 30s. | Evaluates browser system clock in configured timezone. |
| **Precedence Policy** | **Highest**. When online, physically executes movements. | **Secondary**. If physical device checks in, simulator immediately turns OFF. |
