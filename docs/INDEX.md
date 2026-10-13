# Sage Bot 2.0 — Project Documentation

Welcome to the comprehensive documentation suite for **Sage Bot 2.0**, a smart IoT medicine reminder and automatic dispenser controlled via web and Supabase, running on an ESP32 microcontroller.

---

## 📚 Documentation Directory

| Document | Description | Target Audience |
|---|---|---|
| [1. System Architecture](SYSTEM_ARCHITECTURE.md) | High-level system topology, frontend structure, telemetry loops, and state machines. | System Architects, Full-Stack Devs |
| [2. Hardware Specification & Pinouts](HARDWARE_SPECIFICATION.md) | Hardware modules, ESP32 GPIO pinout tables, wiring notes, and graceful degradation rules. | Hardware / Embedded Engineers |
| [3. Database Schema & RLS](DATABASE_SCHEMA.md) | PostgreSQL data dictionary, constraints, prototype Row-Level Security, Realtime setup, and SQL migration. | Backend / Database Engineers |
| [4. ESP32 Firmware Contract](ESP32_FIRMWARE_CONTRACT.md) | PostgREST HTTP protocol, request/response formats, loop timings, and edge cases. | Embedded C++/Arduino Engineers |
| [5. Lovable Deployment Guide](LOVABLE_DEPLOYMENT_GUIDE.md) | Step-by-step instructions and prompts for recreating the stack in Lovable. | AI App Builders, Frontend Devs |

---

## ⚡ Quick System Overview

```mermaid
flowchart TD
    subgraph Frontend["Sage Bot Web Console (React / Lovable)"]
        UI["Tactile UI (Rotor Disc + OLED Preview)"]
        Store["Client Store (appStore)"]
        Sim["Virtual Device Simulator (In-Browser)"]
    end

    subgraph Supabase["Supabase Cloud / PostgreSQL"]
        DB_Status["device_status (id=1)"]
        DB_Cmds["commands (Queue)"]
        DB_Events["dose_events"]
        DB_Slots["slots (1..8)"]
        DB_Sched["schedules"]
        DB_Config["hardware_config (id=1)"]
        Realtime["Realtime Engine (WebSockets)"]
    end

    subgraph Hardware["Physical Dispenser (ESP32)"]
        ESP["ESP32 Controller"]
        OLED["0.96 inch I2C OLED (Connected)"]
        Stepper["ULN2003 + 28BYJ-48 (Planned)"]
        Hall["A3144 Hall Sensor (Planned)"]
        Shutter["SG90 Servo + IR Sensor (Planned)"]
        Inputs["Button / LED / Buzzer (Planned)"]
    end

    UI <-->|Realtime / Polling| Supabase
    Sim <-->|When Simulator ON| Supabase
    ESP <-->|REST API (Bearer Anon Key)| Supabase
    ESP --> OLED
    ESP -.-> Stepper
    ESP -.-> Hall
    ESP -.-> Shutter
    ESP -.-> Inputs
```

---

## 🎯 Core Operating Principles

1. **Hardware-Agnostic Operation**: The application functions with **any combination** of components connected. By default, only the 0.96-inch OLED is active.
2. **Graceful Degradation**: When a part is toggled OFF in `hardware_config`, operations that depend on it are not blocked—they transition to software-assisted or simulated modes.
3. **Dual Controller Support**:
   - When a physical ESP32 is online, it acts as the primary hardware controller.
   - When offline, the web application's built-in simulator can take over in-browser without code modifications.
   - If a physical device checks in, the simulator automatically stands down.
