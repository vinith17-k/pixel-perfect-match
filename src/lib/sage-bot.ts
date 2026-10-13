import type { Json } from "@/integrations/supabase/types";

export const HARDWARE_PARTS = [
  { key: "has_oled", label: "OLED", pin: "SDA D21 · SCL D22 · 3V3 · GND" },
  { key: "has_stepper", label: "Stepper", pin: "IN1 D14 · IN2 D27 · IN3 D26 · IN4 D25 · VIN 5V" },
  { key: "has_hall", label: "Hall", pin: "OUT D33 · VCC 5V · GND" },
  { key: "has_ir", label: "IR", pin: "OUT D32 · VCC 3V3 · GND" },
  { key: "has_servo", label: "Servo", pin: "Signal D18 · Red 5V · Brown GND" },
  { key: "has_button", label: "Button", pin: "Leg A D4 · opposite leg GND" },
  { key: "has_led", label: "LED", pin: "D15 via 220Ω · short leg GND" },
  { key: "has_buzzer", label: "Buzzer", pin: "+ D13 · − GND" },
] as const;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const SCREEN_PRESETS = {
  boot: ["SAGE BOT", "Starting up…", "Please wait"],
  home: ["SAGE BOT", "READY", "Next dose: 08:00"],
  alarm: ["DOSE DUE", "Medicine ready", "Mark in app"],
  taken: ["DOSE TAKEN", "Thank you", "See you soon"],
  missed: ["DOSE MISSED", "Please check app", "Stay safe"],
  loading: ["LOAD SLOT 01", "Add medicine", "Then tap done"],
  moving: ["MOVING DISC", "Please wait", "Slot 03"],
  message: ["SAGE BOT", "Hello there!", "Have a good day"],
  error: ["DEVICE PAUSED", "Check connection", "See app details"],
  wifi: ["CONNECTING", "Joining Wi-Fi", "Please wait"],
} as const;

export type ScreenName = keyof typeof SCREEN_PRESETS;
export type DoseStatus = "due" | "taken" | "missed" | "skipped" | "snoozed";
export type HardwareKey = (typeof HARDWARE_PARTS)[number]["key"];

export function asRecord(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function dateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function timeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatWhen(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function localScheduleInstant(day: Date, clock: string, timeZone: string): string | null {
  const [hourText, minuteText] = clock.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(day);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const date = Number(parts.find((part) => part.type === "day")?.value);
  if (![year, month, date, hour, minute].every(Number.isFinite)) return null;

  let utc = Date.UTC(year, month - 1, date, hour, minute);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const getPart = (name: string) => Number(current.find((part) => part.type === name)?.value);
    const observed = Date.UTC(
      getPart("year"),
      getPart("month") - 1,
      getPart("day"),
      getPart("hour"),
      getPart("minute"),
    );
    const intended = Date.UTC(year, month - 1, date, hour, minute);
    utc += intended - observed;
  }
  const output = new Date(utc);
  if (dateInZone(output, timeZone) !== `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`) return null;
  return output.toISOString();
}

export function initials(name: string): string {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  return pieces.slice(0, 2).map((piece) => piece.charAt(0).toUpperCase()).join("") || "SB";
}