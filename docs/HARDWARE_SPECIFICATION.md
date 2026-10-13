# Hardware Specification & Pinouts

Sage Bot is built around the **ESP32 DevKit V1** microcontroller. It is designed to work with **any subset of hardware peripherals connected**, degrading gracefully when a module is absent.

---

## 📌 GPIO Pinout Table

> [!CAUTION]
> **Do NOT use GPIO 12 (D12)**. D12 is a strapping pin that controls the internal flash voltage on ESP32 boot. Pulling it HIGH or LOW externally during startup can prevent the ESP32 from booting or cause flash brownouts.

| Module | Component Model | ESP32 Pin (D-Label) | Signal / Function | Electrical Notes |
|---|---|---|---|---|
| **OLED Display** | 0.96" I²C SSD1306 | `D21`<br>`D22`<br>`3V3`<br>`GND` | SDA<br>SCL<br>Power<br>Ground | Address `0x3C`. Requires 3.3V logic. Pull-ups to 3.3V recommended. |
| **Stepper Motor** | 28BYJ-48 + ULN2003 Driver | `D14`<br>`D27`<br>`D26`<br>`D25`<br>`VIN`<br>`GND` | IN1<br>IN2<br>IN3<br>IN4<br>+5V Power<br>Ground | Motor 5-pin plug inserts into driver socket. Power from `VIN` (5V external / USB), NOT from `3V3`. |
| **Hall Sensor** | A3144 Hall Effect Sensor | `D33`<br>`VIN`<br>`GND` | Signal OUT<br>+5V Power<br>Ground | Magnet glued to rotor disc at Slot 1. Sensor detects proximity to establish zero-index position. |
| **IR Sensor** | FC-51 Infrared Proximity | `D32`<br>`3V3`<br>`GND` | Signal OUT<br>Power<br>Ground | Detects patient's hand under the chute. Sensitivity potentiometer tuned to ~5–10cm. |
| **Servo Motor** | SG90 Micro Servo (Flap Shutter) | `D18`<br>`VIN`<br>`GND` | PWM Signal<br>+5V (Red)<br>Ground (Brown) | **Important**: Place a 470µF electrolytic capacitor across 5V and GND near the servo to absorb inrush current spikes. |
| **Push Button** | Momentary Tactile Switch | `D4`<br>`GND` | Leg A<br>Leg B | Connect between D4 and GND. Use internal pull-up (`INPUT_PULLUP`). |
| **Status LED** | 5mm LED | `D15`<br>`GND` | Anode (+)<br>Cathode (−) | D15 through a **220Ω current-limiting resistor** to the long leg (anode). Short leg to GND. |
| **Active Buzzer** | 5V Active Buzzer | `D13`<br>`GND` | Positive (+)<br>Ground (−) | Active buzzer (beeps when GPIO driven HIGH). Observe polarity. |

---

## 🔄 Hardware Profile & Graceful Degradation Rules

The physical device and the web application adapt dynamically based on `hardware_config`. When a peripheral is toggled **OFF**, features do not break or disappear; they transition into a software-fallback workflow:

| Peripheral | Database Flag | When Turned ON | When Turned OFF (Graceful Degradation) |
|---|---|---|---|
| **OLED Display** | `has_oled` | Realtime status mirror on physical 128x64 display. | Only the web app shows reminders and alerts. Live preview shows "OLED disabled". |
| **Stepper Motor** | `has_stepper` | Disc automatically indexes and rotates compartments into the chute. | "Rotate to slot" commands are marked `simulated`. The OLED displays `LOAD SLOT N` or `TAKE SLOT N` so the patient picks the compartment by hand. UI displays a **"Virtual Slot"** badge. |
| **Hall Sensor** | `has_hall` | Disc automatically indexes home position upon boot. | Homing is skipped. Device assumes it starts at Slot 1. If Stepper is ON, UI shows warning chip: *"Homing off, position not verified"*. |
| **IR Sensor + Servo** | `has_ir`<br>`has_servo` | Shutter flap opens automatically when hand is detected under chute. | Flap remains stationary. Alarms proceed immediately to "Waiting for taken". |
| **Push Button** | `has_button` | Patient presses the physical device button to acknowledge dose. | Physical button disabled. OLED displays *"Mark taken in app"*. Web UI shows a prominent **"Mark as taken"** action button. |
| **LED Indicator** | `has_led` | Blinks during active alarms and command pulses. | LED signaling skipped silently. OLED and web alerts continue. |
| **Buzzer** | `has_buzzer` | Emits audio beeps during active alarms. | Audio alerts skipped silently. Visual alerts continue. |

---

## 🧪 Hardware Test Command Matrix

The web application's **Hardware** page provides dedicated **Test** buttons for each module that dispatch commands into the `commands` table:

| Test Command Type | Target Peripheral | Expected Physical Behavior (When ON) | Simulated Behavior (When OFF) |
|---|---|---|---|
| `test_oled` | OLED | Renders a full pixel test pattern and logo for 4 seconds. | Result logged as `simulated: OLED disabled`. |
| `test_stepper` | Stepper | Rotates the rotor disc 45° (one full compartment index). | Result: `simulated: Stepper not enabled`. |
| `test_hall` | Hall Sensor | Reads D33 logic state and returns `"Magnet detected"` or `"Not detected"`. | Result: `simulated: Hall not enabled`. |
| `test_ir` | IR Sensor | Polls sensor for 3 seconds and returns `"Object detected"` if hand present. | Result: `simulated: IR not enabled`. |
| `test_servo` | Servo | Opens shutter to 90°, pauses 1 second, and closes to 0°. | Result: `simulated: Servo not enabled`. |
| `test_button` | Button | Waits up to 5 seconds for button press: returns `"Button pressed"`. | Result: `simulated: Button not enabled`. |
| `test_led` | LED | Blinks D15 3 times in rapid succession (100ms intervals). | Result: `simulated: LED not enabled`. |
| `test_buzzer` | Buzzer | Plays a double beep pattern (200ms ON, 100ms OFF, 200ms ON). | Result: `simulated: Buzzer not enabled`. |
