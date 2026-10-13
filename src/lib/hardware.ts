import type { PartMeta } from '../types';

/** Static metadata for all 8 hardware parts */
export const PART_META: PartMeta[] = [
  {
    key: 'has_oled',
    label: 'OLED Display',
    shortLabel: 'OLED',
    icon: 'Monitor',
    testCommand: 'test_oled',
    pins: [
      { pin: 'D21', label: 'SDA' },
      { pin: 'D22', label: 'SCL' },
      { pin: '3V3', label: 'VCC' },
      { pin: 'GND', label: 'GND' },
    ],
    wiringNote: '0.96-inch I²C OLED. Address 0x3C. Pull SDA/SCL up to 3V3 with 4.7kΩ resistors.',
  },
  {
    key: 'has_stepper',
    label: 'Stepper Motor',
    shortLabel: 'Stepper',
    icon: 'RotateCw',
    testCommand: 'test_stepper',
    pins: [
      { pin: 'D14', label: 'IN1' },
      { pin: 'D27', label: 'IN2' },
      { pin: 'D26', label: 'IN3' },
      { pin: 'D25', label: 'IN4' },
      { pin: 'VIN', label: '+ (5V)' },
      { pin: 'GND', label: '−' },
    ],
    wiringNote: "28BYJ-48 + ULN2003 driver. Plug the motor's 5-wire connector into the ULN2003 socket.",
  },
  {
    key: 'has_hall',
    label: 'Hall Sensor',
    shortLabel: 'Hall',
    icon: 'Magnet',
    testCommand: 'test_hall',
    pins: [
      { pin: 'D33', label: 'OUT' },
      { pin: 'VIN', label: 'VCC (5V)' },
      { pin: 'GND', label: 'GND' },
    ],
    wiringNote: 'A3144 sensor. Glue the magnet on the disc at slot 1. Sensor goes on the fixed frame.',
  },
  {
    key: 'has_ir',
    label: 'IR Sensor',
    shortLabel: 'IR',
    icon: 'Eye',
    testCommand: 'test_ir',
    pins: [
      { pin: 'D32', label: 'OUT' },
      { pin: '3V3', label: 'VCC' },
      { pin: 'GND', label: 'GND' },
    ],
    wiringNote: 'FC-51 proximity sensor. Detects hand below the dispense chute.',
  },
  {
    key: 'has_servo',
    label: 'Servo (Shutter)',
    shortLabel: 'Servo',
    icon: 'Settings2',
    testCommand: 'test_servo',
    pins: [
      { pin: 'D18', label: 'Signal' },
      { pin: 'VIN', label: 'Red (+5V)' },
      { pin: 'GND', label: 'Brown (−)' },
    ],
    wiringNote: 'SG90 servo. Add a 470µF capacitor across the 5V and GND rails to prevent brownouts.',
  },
  {
    key: 'has_button',
    label: 'Push Button',
    shortLabel: 'Button',
    icon: 'Circle',
    testCommand: 'test_button',
    pins: [
      { pin: 'D4', label: 'One leg' },
      { pin: 'GND', label: 'Opposite leg' },
    ],
    wiringNote: 'Momentary push button. Uses internal pull-up. Do NOT add an external pull-up.',
  },
  {
    key: 'has_led',
    label: 'LED Indicator',
    shortLabel: 'LED',
    icon: 'Lightbulb',
    testCommand: 'test_led',
    pins: [
      { pin: 'D15', label: 'Anode (+, long leg) via 220Ω' },
      { pin: 'GND', label: 'Cathode (−, short leg)' },
    ],
    wiringNote: 'Use a 220Ω resistor between D15 and the LED anode.',
  },
  {
    key: 'has_buzzer',
    label: 'Buzzer',
    shortLabel: 'Buzzer',
    icon: 'Volume2',
    testCommand: 'test_buzzer',
    pins: [
      { pin: 'D13', label: '+ (positive)' },
      { pin: 'GND', label: '− (negative)' },
    ],
    wiringNote: 'Active buzzer (not passive). Polarity matters — connect + to D13.',
    warning: 'Do NOT use D12 — it is a boot-mode strapping pin on ESP32.',
  },
];

/** Look up a part by its hardware_config key */
export const getPartMeta = (key: string): PartMeta | undefined =>
  PART_META.find((p) => p.key === key);

/** The order parts appear in the chip row */
export const PART_DISPLAY_ORDER = PART_META.map((p) => p.key);
