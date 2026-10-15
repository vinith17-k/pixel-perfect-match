# Hardware Specification & Pinouts

The current ESP32 firmware supports five peripherals. Hall and IR sensors and the servo motor are intentionally out of scope.

> **Caution:** Do not use GPIO `D12`; it is an ESP32 boot strapping pin.

## Supported GPIO pinout

| Module | Component | ESP32 pins | Notes |
|---|---|---|---|
| OLED | 0.96-inch I²C SH1106/SSD1306 | SDA `D21`, SCL `D22`, 3V3, GND | Firmware initializes an SH1106 display. |
| Stepper | 28BYJ-48 + ULN2003 | IN1 `D14`, IN2 `D27`, IN3 `D26`, IN4 `D25`; VIN/5V and GND for driver | Carousel position is estimated in software; no home sensor is connected. |
| Push button | Momentary tactile button | `D4` to GND | Firmware uses `INPUT_PULLUP`. |
| Status LED | 5mm LED | `D15` through 220Ω resistor to LED anode; cathode to GND | Do not connect the LED without its current-limiting resistor. |
| Buzzer | Active buzzer | Positive to `D13`, negative to GND | Confirm polarity. |

## Positioning and dispensing limitations

The stepper's logical starting slot is set to Slot 1 at boot, but there is no feedback sensor to verify rotor position or detect missed steps. Manually align the disc after restart and before relying on slot selection. The device has no servo-controlled shutter and does not sense a pill passing through a chute. Do not interpret a commanded rotation as confirmed dispensing.

The web app's hardware profile and diagnostics expose the five supported parts only. The firmware's schedule fetch is currently used only for the OLED's next-dose preview; it does not run offline alarms.

## Supported hardware tests

| Command | Behavior |
|---|---|
| `test_oled` | Displays an OLED test message. |
| `test_stepper` | Moves one estimated slot forward and back. |
| `test_button` | Reports the button's instantaneous state. |
| `test_led` | Blinks the status LED. |
| `test_buzzer` | Beeps the active buzzer. |

Hall, IR, and servo test commands are not supported.
