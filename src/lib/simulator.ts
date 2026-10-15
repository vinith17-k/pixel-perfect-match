/**
 * simulator.ts
 * ─────────────────────────────────────────────────────────────────
 * Browser-based virtual ESP32 device simulator for Sage Bot 2.0.
 *
 * When simulatorMode is ON this module:
 *  • Sends a heartbeat to device_status every 10 s
 *  • Processes pending commands from the `commands` table every 3 s
 *  • Creates dose_events for enabled schedules every 30 s
 *  • Marks overdue 'due'/'snoozed' events as 'missed'
 *
 * Exports:
 *  - startSimulator(config, schedules, slots): () => void
 *  - fastForward(schedules, slots, config): Promise<void>
 */

import { format, addMinutes, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { supabase } from './supabase';
import type {
  HardwareConfig,
  Schedule,
  Slot,
  OledScreen,
  DeviceState,
} from '../types/index';

// ─── Constants ────────────────────────────────────────────────────
const HEARTBEAT_MS   = 10_000;  // 10 s
const COMMAND_MS     =  3_000;  // 3 s
const SCHEDULE_MS   = 30_000;  // 30 s
const FIRMWARE_TAG   = 'simulator';
const SIM_IP         = '127.0.0.1';
const SIM_RSSI       = -42;
const PREFIX         = '[Simulator]';

// ─── Helpers ──────────────────────────────────────────────────────

/** Log with simulator prefix – non-fatal */
function log(...args: unknown[]): void {
  console.log(PREFIX, ...args);
}
function warn(...args: unknown[]): void {
  console.warn(PREFIX, ...args);
}

/** Build parts_ok map from HardwareConfig */
function buildPartsOk(config: HardwareConfig): Record<string, boolean> {
  return {
    oled:    config.has_oled,
    stepper: config.has_stepper,
    button:  config.has_button,
    led:     config.has_led,
    buzzer:  config.has_buzzer,
  };
}

/** Current time formatted for display in the device timezone */
function nowInTz(tz: string): { timeStr: string; dateStr: string; dayOfWeek: number } {
  const zoned = toZonedTime(new Date(), tz);
  return {
    timeStr:   format(zoned, 'HH:mm'),
    dateStr:   format(zoned, 'EEE, dd MMM yyyy'),
    dayOfWeek: zoned.getDay(), // 0=Sun … 6=Sat
  };
}

/** Find the next upcoming schedule entry (any day) sorted by minutes-from-now */
function findNextSchedule(
  schedules: Schedule[],
  slots: Slot[],
  tz: string,
): { schedule: Schedule; slot: Slot | null; minutesAway: number } | null {
  const enabled = schedules.filter((s) => s.enabled);
  if (!enabled.length) return null;

  const now = toZonedTime(new Date(), tz);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowDay = now.getDay();

  // Build candidates: for each schedule, find the next fire time (today or future day)
  type Candidate = { schedule: Schedule; slot: Slot | null; minutesAway: number };
  const candidates: Candidate[] = [];

  for (const sched of enabled) {
    if (!sched.days.length) continue;

    const [h, m] = sched.time_of_day.split(':').map(Number);
    const schedMinutes = h * 60 + m;
    const slot = slots.find((sl) => sl.slot_number === sched.slot_number) ?? null;

    // Look ahead up to 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDay = (nowDay + dayOffset) % 7;
      if (!sched.days.includes(targetDay)) continue;

      const minutesAway =
        dayOffset * 1440 + schedMinutes - nowMinutes;

      if (minutesAway <= 0 && dayOffset === 0) continue; // already past today

      candidates.push({ schedule: sched, slot, minutesAway });
      break; // earliest day for this schedule is enough
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.minutesAway - b.minutesAway);
  return candidates[0];
}

/** Build the scheduled_for UTC ISO for a schedule firing "today" in the given timezone */
function scheduledForTodayUTC(timeOfDay: string, tz: string): string {
  const [h, m] = timeOfDay.split(':').map(Number);
  const now = toZonedTime(new Date(), tz);
  // Build a local date at the schedule time
  const localDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h,
    m,
    0,
    0,
  );
  // Convert zoned → UTC
  return fromZonedTime(localDate, tz).toISOString();
}

/** Build scheduled_for UTC ISO for a specific day offset from now */
function scheduledForOffsetUTC(
  timeOfDay: string,
  tz: string,
  dayOffset: number,
): string {
  const [h, m] = timeOfDay.split(':').map(Number);
  const now = toZonedTime(new Date(), tz);
  const localDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    h,
    m,
    0,
    0,
  );
  return fromZonedTime(localDate, tz).toISOString();
}

// ─── OLED Screen Builder ───────────────────────────────────────────

function buildHomeScreen(
  tz: string,
  schedules: Schedule[],
  slots: Slot[],
): OledScreen {
  const { timeStr, dateStr } = nowInTz(tz);

  const next = findNextSchedule(schedules, slots, tz);
  let nextLine = 'No upcoming doses';
  if (next) {
    const med = next.schedule.medicine?.name ?? `Slot ${next.schedule.slot_number}`;
    const [h, m] = next.schedule.time_of_day.split(':').map(Number);
    const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    nextLine = `Next: ${med} ${timeLabel} S${next.schedule.slot_number}`;
  }

  return {
    screen: 'home',
    lines: [timeStr, dateStr, nextLine],
  };
}

function buildAlarmScreen(
  medicineName: string,
  dose: string | null,
  slotNumber: number,
  hasButton: boolean,
): OledScreen {
  return {
    screen: 'alarm',
    lines: [
      'TAKE MEDICINE',
      medicineName,
      `${dose ?? '1 pill'} Slot ${slotNumber}`,
      hasButton ? 'Press btn or app' : 'Mark in app',
    ],
  };
}

function buildTestScreen(): OledScreen {
  return {
    screen: 'test',
    lines: ['OLED TEST OK', 'Sage Bot 2.0', 'Simulator', new Date().toLocaleTimeString()],
  };
}

// ─── Heartbeat ────────────────────────────────────────────────────

async function sendHeartbeat(
  config: HardwareConfig,
  schedules: Schedule[],
  slots: Slot[],
): Promise<void> {
  try {
    const oled = buildHomeScreen(config.timezone, schedules, slots);

    const { error } = await supabase
      .from('device_status')
      .upsert(
        {
          id: 1,
          last_seen:  new Date().toISOString(),
          state:      'idle' as DeviceState,
          firmware:   FIRMWARE_TAG,
          ip:         SIM_IP,
          rssi:       SIM_RSSI,
          parts_ok:   buildPartsOk(config),
          oled_screen: oled,
        },
        { onConflict: 'id' },
      );

    if (error) warn('Heartbeat error:', error.message);
    else log('Heartbeat sent');
  } catch (err) {
    warn('Heartbeat exception:', err);
  }
}

// ─── Command processor ────────────────────────────────────────────

async function processPendingCommands(
  config: HardwareConfig,
  schedules: Schedule[],
  slots: Slot[],
): Promise<void> {
  try {
    const { data: commands, error } = await supabase.rpc('claim_next_command');

    if (error) { warn('Command fetch error:', error.message); return; }
    if (!Array.isArray(commands) || !commands.length) return;

    for (const cmd of commands) {
      if (
        cmd && typeof cmd === 'object' &&
        'id' in cmd && typeof cmd.id === 'number' &&
        'type' in cmd && typeof cmd.type === 'string' &&
        'payload' in cmd && cmd.payload !== null && typeof cmd.payload === 'object'
      ) {
        await processCommand({
          id: cmd.id,
          type: cmd.type,
          payload: cmd.payload as Record<string, unknown>,
        }, config, schedules, slots);
      } else {
        warn('Ignoring malformed command returned by claim_next_command.');
      }
    }
  } catch (err) {
    warn('Command processor exception:', err);
  }
}

interface SimulatorCommand {
  id: number;
  type: string;
  payload: Record<string, unknown>;
}

async function processCommand(
  cmd: SimulatorCommand,
  config: HardwareConfig,
  schedules: Schedule[],
  slots: Slot[],
): Promise<void> {
  const now = new Date().toISOString();
  log(`Processing command #${cmd.id} type=${cmd.type}`);

  let resultStatus: 'done' | 'failed' | 'simulated' = 'simulated';
  let resultPayload: Record<string, unknown> = {};
  let oledUpdate: OledScreen | null = null;

  try {
    switch (cmd.type) {
      // ── Motion commands ──────────────────────────────────────────
      case 'rotate_to_slot': {
        const slot = cmd.payload?.slot ?? '?';
        resultStatus  = 'simulated';
        resultPayload = { note: `Simulated stepper rotate to slot ${slot}` };
        break;
      }

      case 'home': {
        resultStatus  = 'failed';
        resultPayload = { error: 'Automatic homing requires a position sensor, which is not installed.' };
        break;
      }

      // ── Load done ────────────────────────────────────────────────
      case 'load_done': {
        const screen = buildHomeScreen(config.timezone, schedules, slots);
        oledUpdate    = screen;
        resultStatus  = 'done';
        resultPayload = { note: 'Load acknowledged by simulator' };
        break;
      }

      // ── OLED ─────────────────────────────────────────────────────
      case 'show_message': {
        const msg   = cmd.payload?.message ?? '';
        const lines = typeof msg === 'string' ? msg.split('\n') : [String(msg)];
        oledUpdate = { screen: 'message', lines };
        resultStatus  = 'done';
        resultPayload = { note: 'Message shown on simulated OLED' };
        break;
      }

      case 'test_oled': {
        oledUpdate    = buildTestScreen();
        resultStatus  = config.has_oled ? 'done' : 'simulated';
        resultPayload = { note: config.has_oled ? 'OLED test screen rendered by simulator' : 'OLED disabled' };
        break;
      }

      // ── Dose flow commands ────────────────────────────────────────
      case 'stop_alarm':
      case 'mark_taken':
      case 'snooze':
      case 'skip': {
        resultStatus  = 'done';
        resultPayload = { note: `${cmd.type} acknowledged by simulator` };
        break;
      }

      // ── Hardware test commands ────────────────────────────────────
      case 'test_stepper': {
        resultStatus  = 'simulated';
        resultPayload = { note: 'Stepper driver not present – simulated 200-step rotation' };
        break;
      }

      case 'test_button': {
        resultStatus  = 'simulated';
        resultPayload = { note: 'Physical button not present – simulated press event' };
        break;
      }
      case 'test_led': {
        resultStatus  = 'simulated';
        resultPayload = { note: 'LED not present – simulated blink 3×' };
        break;
      }
      case 'test_buzzer': {
        resultStatus  = 'simulated';
        resultPayload = { note: 'Buzzer not present – simulated 500 ms beep' };
        break;
      }

      // ── Fallback ─────────────────────────────────────────────────
      default: {
        resultStatus  = 'failed';
        resultPayload = { error: `Unknown command type "${cmd.type}"` };
        break;
      }
    }
  } catch (err) {
    warn(`Error processing command #${cmd.id}:`, err);
    resultStatus  = 'failed';
    resultPayload = { error: String(err) };
  }

  // Persist result
  const updates: Record<string, unknown> = {
    status:  resultStatus,
    result:  resultPayload,
    done_at: now,
  };

  const { data: completed, error: updateErr } = await supabase.rpc('complete_device_command', {
    p_id: cmd.id,
    p_status: resultStatus,
    p_result: updates.result,
  });
  if (updateErr) warn(`Failed to complete command #${cmd.id}:`, updateErr.message);
  else if (!completed) warn(`Command #${cmd.id} was no longer owned by this simulator.`);

  // Update OLED in device_status if needed
  if (oledUpdate) {
    const { error: oledErr } = await supabase
      .from('device_status')
      .update({ oled_screen: oledUpdate, last_seen: now })
      .eq('id', 1);

    if (oledErr) warn('Failed to update OLED after command:', oledErr.message);
  }
}

// ─── Dose event creation ──────────────────────────────────────────

async function checkSchedules(
  schedules: Schedule[],
  slots: Slot[],
  config: HardwareConfig,
): Promise<void> {
  const tz = config.timezone;
  const enabled = schedules.filter((s) => s.enabled);
  if (!enabled.length) return;

  const { timeStr: _t, dateStr: _d, dayOfWeek } = nowInTz(tz);

  for (const sched of enabled) {
    try {
      if (!sched.days.includes(dayOfWeek)) continue;

      const [h, m] = sched.time_of_day.split(':').map(Number);
      const now = toZonedTime(new Date(), tz);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const schedMinutes = h * 60 + m;

      // Fire window: ±1 minute from scheduled time
      if (nowMinutes !== schedMinutes) continue;

      const scheduledFor = scheduledForTodayUTC(sched.time_of_day, tz);

      // Check if event already exists for this schedule + scheduled_for
      const { data: existing, error: fetchErr } = await supabase
        .from('dose_events')
        .select('id')
        .eq('schedule_id', sched.id)
        .eq('scheduled_for', scheduledFor)
        .maybeSingle();

      if (fetchErr) { warn('Dose check error:', fetchErr.message); continue; }
      if (existing) continue; // already created

      // Resolve medicine name
      const slot = slots.find((sl) => sl.slot_number === sched.slot_number);
      const medicineName =
        sched.medicine?.name ?? slot?.medicine?.name ?? `Slot ${sched.slot_number}`;
      const dose = sched.medicine?.dose ?? slot?.medicine?.dose ?? null;

      const { error: insertErr } = await supabase.from('dose_events').insert({
        schedule_id:   sched.id,
        slot_number:   sched.slot_number,
        medicine_name: medicineName,
        dose,
        scheduled_for: scheduledFor,
        status:        'due',
        taken_at:      null,
        taken_via:     null,
        snooze_until:  null,
      });

      if (insertErr) {
        warn(`Failed to create dose_event for schedule ${sched.id}:`, insertErr.message);
      } else {
        log(`Created dose_event for "${medicineName}" at ${scheduledFor}`);

        // Update OLED to alarm state
        const oled = buildAlarmScreen(
          medicineName,
          dose,
          sched.slot_number,
          config.has_button,
        );
        await supabase
          .from('device_status')
          .update({ state: 'alarm', oled_screen: oled, last_seen: new Date().toISOString() })
          .eq('id', 1);
      }
    } catch (err) {
      warn(`Exception checking schedule ${sched.id}:`, err);
    }
  }
}

// ─── Mark missed events ───────────────────────────────────────────

async function markMissedEvents(config: HardwareConfig): Promise<void> {
  try {
    const now = new Date();

    // Fetch all due/snoozed events that are old enough
    const { data: events, error } = await supabase
      .from('dose_events')
      .select('id, scheduled_for, snooze_until, status')
      .in('status', ['due', 'snoozed']);

    if (error) { warn('Missed fetch error:', error.message); return; }
    if (!events?.length) return;

    const toMiss: string[] = [];

    for (const ev of events) {
      let deadline: Date;

      if (ev.status === 'snoozed' && ev.snooze_until) {
        deadline = addMinutes(parseISO(ev.snooze_until), config.missed_after_minutes);
      } else {
        deadline = addMinutes(parseISO(ev.scheduled_for), config.missed_after_minutes);
      }

      if (now > deadline) {
        toMiss.push(ev.id);
      }
    }

    if (!toMiss.length) return;

    const { error: updateErr } = await supabase
      .from('dose_events')
      .update({ status: 'missed' })
      .in('id', toMiss);

    if (updateErr) warn('Mark missed error:', updateErr.message);
    else log(`Marked ${toMiss.length} event(s) as missed`);
  } catch (err) {
    warn('Mark missed exception:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Start the browser-side device simulator.
 *
 * @param config    Current hardware config row
 * @param schedules Current list of schedules (with joined medicine/slot)
 * @param slots     Current list of slots (with joined medicine)
 * @returns         Cleanup function – call it to stop the simulator
 */
export function startSimulator(
  config: HardwareConfig,
  schedules: Schedule[],
  slots: Slot[],
): () => void {
  log('Starting simulator…');

  // Keep mutable refs so the caller can pass updated data without restarting
  let _config    = config;
  let _schedules = schedules;
  let _slots     = slots;

  // Allow the caller to push fresh data between intervals
  const update = (
    newConfig: HardwareConfig,
    newSchedules: Schedule[],
    newSlots: Slot[],
  ) => {
    _config    = newConfig;
    _schedules = newSchedules;
    _slots     = newSlots;
  };

  // Attach updater to the cleanup function return value so consumers can call it
  // (We expose it via the returned object below)

  // ── Heartbeat: every 10 s ──────────────────────────────────────
  sendHeartbeat(_config, _schedules, _slots); // immediate first ping
  const heartbeatTimer = setInterval(() => {
    sendHeartbeat(_config, _schedules, _slots).catch(console.error);
  }, HEARTBEAT_MS);

  // ── Commands: every 3 s ────────────────────────────────────────
  const commandTimer = setInterval(() => {
    processPendingCommands(_config, _schedules, _slots).catch(console.error);
  }, COMMAND_MS);

  // ── Schedules + missed: every 30 s ────────────────────────────
  checkSchedules(_schedules, _slots, _config); // immediate first check
  markMissedEvents(_config);
  const scheduleTimer = setInterval(() => {
    checkSchedules(_schedules, _slots, _config).catch(console.error);
    markMissedEvents(_config).catch(console.error);
  }, SCHEDULE_MS);

  log('Simulator running. Intervals: heartbeat=10s, commands=3s, schedules=30s');

  /** Cleanup – stops all intervals */
  const cleanup = () => {
    clearInterval(heartbeatTimer);
    clearInterval(commandTimer);
    clearInterval(scheduleTimer);

    // Set device offline
    supabase
      .from('device_status')
      .update({ state: 'offline', last_seen: new Date().toISOString() })
      .eq('id', 1)
      .then(
        () => log('Simulator stopped, device marked offline'),
        (err) => console.error(err)
      );
  };

  // Attach the update helper as a non-enumerable property so the parent
  // component can push fresh data without restarting the simulator.
  Object.defineProperty(cleanup, 'update', {
    value: update,
    writable: false,
    enumerable: false,
  });

  return cleanup;
}

/**
 * Fast-forward to the next upcoming dose.
 *
 * Finds the next enabled schedule that hasn't fired yet, computes its
 * scheduled_for timestamp, and inserts a 'due' dose_event immediately
 * (skipping the 30-second polling window).
 */
export async function fastForward(
  schedules: Schedule[],
  slots: Slot[],
  config: HardwareConfig,
): Promise<void> {
  const tz = config.timezone;
  log('Fast-forward requested…');

  const next = findNextSchedule(schedules, slots, tz);
  if (!next) {
    warn('Fast-forward: no upcoming schedules found');
    return;
  }

  const { schedule: sched, slot, minutesAway } = next;

  // Determine which day offset holds the next fire
  const now = toZonedTime(new Date(), tz);
  const nowDay = now.getDay();
  const [h, m] = sched.time_of_day.split(':').map(Number);
  const schedMinutes = h * 60 + m;
  const nowMinutes   = now.getHours() * 60 + now.getMinutes();

  // dayOffset: 0 = today (if still in future), else 1-6
  let dayOffset = Math.ceil((minutesAway - (schedMinutes - nowMinutes)) / 1440);
  // Simpler: use the first matching day in sched.days starting from today
  dayOffset = 0;
  for (let d = 0; d < 7; d++) {
    const targetDay = (nowDay + d) % 7;
    if (!sched.days.includes(targetDay)) continue;
    const minsAway = d * 1440 + schedMinutes - nowMinutes;
    if (minsAway > 0) { dayOffset = d; break; }
  }

  const scheduledFor = scheduledForOffsetUTC(sched.time_of_day, tz, dayOffset);

  const medicineName =
    sched.medicine?.name ?? slot?.medicine?.name ?? `Slot ${sched.slot_number}`;
  const dose = sched.medicine?.dose ?? slot?.medicine?.dose ?? null;

  log(`Fast-forward → "${medicineName}" S${sched.slot_number} @ ${scheduledFor} (in ~${minutesAway} min)`);

  // Check for existing event first
  const { data: existing, error: fetchErr } = await supabase
    .from('dose_events')
    .select('id')
    .eq('schedule_id', sched.id)
    .eq('scheduled_for', scheduledFor)
    .maybeSingle();

  if (fetchErr) throw new Error(`Fast-forward fetch failed: ${fetchErr.message}`);

  if (existing) {
    log('Fast-forward: dose_event already exists for this slot, skipping insert');
    return;
  }

  const { error: insertErr } = await supabase.from('dose_events').insert({
    schedule_id:   sched.id,
    slot_number:   sched.slot_number,
    medicine_name: medicineName,
    dose,
    scheduled_for: scheduledFor,
    status:        'due',
    taken_at:      null,
    taken_via:     null,
    snooze_until:  null,
  });

  if (insertErr) throw new Error(`Fast-forward insert failed: ${insertErr.message}`);

  log('Fast-forward: dose_event created successfully');

  // Update device OLED to alarm state
  const oled = buildAlarmScreen(medicineName, dose, sched.slot_number, config.has_button);

  const { error: statusErr } = await supabase
    .from('device_status')
    .update({
      state:       'alarm',
      oled_screen: oled,
      last_seen:   new Date().toISOString(),
    })
    .eq('id', 1);

  if (statusErr) warn('Fast-forward: failed to update device_status OLED:', statusErr.message);
}
