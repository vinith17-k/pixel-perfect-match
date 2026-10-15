// ============================================================
// Database types – mirrors the Supabase schema exactly
// ============================================================

export interface Medicine {
  id: string;
  name: string;
  dose: string | null;
  notes: string | null;
  color: string;
  created_at: string;
}

export interface Slot {
  slot_number: number;
  medicine_id: string | null;
  pills_remaining: number;
  status: 'empty' | 'loaded';
  updated_at: string;
  // joined
  medicine?: Medicine | null;
}

export interface Schedule {
  id: string;
  slot_number: number;
  medicine_id: string | null;
  time_of_day: string; // "HH:MM:SS"
  days: number[];      // 0=Sun … 6=Sat
  pills_per_dose: number;
  enabled: boolean;
  created_at: string;
  // joined
  medicine?: Medicine | null;
  slot?: Slot | null;
}

export type DoseStatus = 'due' | 'taken' | 'missed' | 'skipped' | 'snoozed';
export type TakenVia = 'button' | 'website' | 'simulator';

export interface DoseEvent {
  id: string;
  schedule_id: string | null;
  slot_number: number | null;
  medicine_name: string | null;
  dose: string | null;
  scheduled_for: string;
  status: DoseStatus;
  taken_at: string | null;
  taken_via: TakenVia | null;
  snooze_until: string | null;
  created_at: string;
}

export type CommandStatus = 'pending' | 'running' | 'done' | 'failed' | 'simulated';

export interface Command {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  status: CommandStatus;
  result: Record<string, unknown> | null;
  created_at: string;
  done_at: string | null;
  claimed_at?: string | null;
  claimed_by?: string | null;
}

export interface HardwareConfig {
  id: 1;
  has_oled: boolean;
  has_stepper: boolean;
  has_button: boolean;
  has_led: boolean;
  has_buzzer: boolean;
  num_slots: number;
  timezone: string;
  snooze_minutes: number;
  missed_after_minutes: number;
  low_stock_threshold: number;
  updated_at: string;
}

export type DeviceState = 'idle' | 'alarm' | 'loading' | 'moving' | 'offline';

export interface OledScreen {
  screen: string;
  lines: string[];
}

export interface DeviceStatus {
  id: 1;
  last_seen: string | null;
  state: DeviceState;
  current_slot: number | null;
  active_event_id: string | null;
  ip: string | null;
  rssi: number | null;
  firmware: string | null;
  uptime_s: number | null;
  oled_screen: OledScreen | null;
  parts_ok: Record<string, boolean> | null;
}

// ============================================================
// UI-only types
// ============================================================

export type TabId = 'dashboard' | 'slots' | 'schedule' | 'history' | 'hardware' | 'settings';

export type PartKey = 
  | 'has_oled' 
  | 'has_stepper' 
  | 'has_button' 
  | 'has_led' 
  | 'has_buzzer';

export interface PartMeta {
  key: PartKey;
  label: string;
  shortLabel: string;
  icon: string;
  testCommand: string;
  pins: Array<{ pin: string; label: string }>;
  wiringNote: string;
  warning?: string;
}

// Upcoming (derived) dose shown in the dashboard before an event row exists
export interface UpcomingDose {
  schedule_id: string;
  slot_number: number;
  medicine_name: string;
  dose: string | null;
  scheduled_for: string; // ISO UTC
  status: 'upcoming' | 'waiting';
}
