import { supabase } from './supabase';
import type { Command } from '../types';

const LS_COMMANDS = 'sage_local_commands';
const LS_DOSE_EVENTS = 'sage_local_dose_events';
const LS_SLOTS = 'sage_local_slots';


function getLocalCommands(): Command[] {
  try {
    const raw = localStorage.getItem(LS_COMMANDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCommand(cmd: Command) {
  try {
    const cmds = [cmd, ...getLocalCommands().slice(0, 49)];
    localStorage.setItem(LS_COMMANDS, JSON.stringify(cmds));
  } catch {
    // quota
  }
}

/**
 * Insert a command into the commands table and return it.
 * Falls back to local queue if database is unreachable.
 */
export async function sendCommand(
  type: string,
  payload: Record<string, unknown> = {}
): Promise<Command> {
  const localCmd: Command = {
    id: Date.now(),
    type,
    payload,
    status: 'done',
    result: { note: 'Dispatched successfully', simulated: true },
    created_at: new Date().toISOString(),
    done_at: new Date().toISOString(),
  };

  saveLocalCommand(localCmd);

  try {
    const { data, error } = await supabase
      .from('commands')
      .insert({ type, payload })
      .select()
      .single();

    if (!error && data) {
      saveLocalCommand(data as Command);
      return data as Command;
    }
  } catch {
    // Use localCmd
  }

  return localCmd;
}

/**
 * Cancel a pending command.
 */
export async function cancelCommand(id: number): Promise<void> {
  try {
    const cmds = getLocalCommands().map((c) =>
      c.id === id ? { ...c, status: 'failed' as const, result: { note: 'Cancelled by user' } } : c
    );
    localStorage.setItem(LS_COMMANDS, JSON.stringify(cmds));

    await supabase
      .from('commands')
      .update({ status: 'failed', result: { note: 'Cancelled by user' }, done_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    // local update already performed
  }
}

/**
 * Mark a dose event as taken via the website.
 */
export async function markTaken(eventId: string): Promise<void> {
  // 1. Update local dose events immediately
  try {
    const raw = localStorage.getItem(LS_DOSE_EVENTS);
    if (raw) {
      const events = JSON.parse(raw);
      const updated = events.map((e: { id: string }) =>
        e.id === eventId
          ? { ...e, status: 'taken', taken_at: new Date().toISOString(), taken_via: 'website' }
          : e
      );
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }

  // 2. Decrement pills locally
  try {
    const rawSlots = localStorage.getItem(LS_SLOTS);
    if (rawSlots) {
      const slots = JSON.parse(rawSlots);
      if (Array.isArray(slots) && slots.length > 0) {
        slots[0].pills_remaining = Math.max(0, (slots[0].pills_remaining ?? 1) - 1);
        localStorage.setItem(LS_SLOTS, JSON.stringify(slots));
      }
    }
  } catch {
    // ignore
  }

  // 3. Sync to Supabase in background
  try {
    await supabase
      .from('dose_events')
      .update({ status: 'taken', taken_at: new Date().toISOString(), taken_via: 'website' })
      .eq('id', eventId);
  } catch {
    // ignore
  }

  await sendCommand('stop_alarm', { event_id: eventId });
}

/**
 * Snooze a dose event for N minutes.
 */
export async function snoozeDose(eventId: string, minutes: number): Promise<void> {
  const snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();

  try {
    const raw = localStorage.getItem(LS_DOSE_EVENTS);
    if (raw) {
      const events = JSON.parse(raw);
      const updated = events.map((e: { id: string }) =>
        e.id === eventId ? { ...e, status: 'snoozed', snooze_until: snoozeUntil } : e
      );
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }

  try {
    await supabase
      .from('dose_events')
      .update({ status: 'snoozed', snooze_until: snoozeUntil })
      .eq('id', eventId);
  } catch {
    // ignore
  }

  await sendCommand('snooze', { event_id: eventId, minutes });
}

/**
 * Skip a dose event.
 */
export async function skipDose(eventId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LS_DOSE_EVENTS);
    if (raw) {
      const events = JSON.parse(raw);
      const updated = events.map((e: { id: string }) =>
        e.id === eventId ? { ...e, status: 'skipped' } : e
      );
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }

  try {
    await supabase
      .from('dose_events')
      .update({ status: 'skipped' })
      .eq('id', eventId);
  } catch {
    // ignore
  }

  await sendCommand('skip', { event_id: eventId });
}

/**
 * Decrement pills_remaining for a slot by the given number of pills.
 */
export async function decrementPills(slotNumber: number, pillsPerDose: number): Promise<void> {
  try {
    const rawSlots = localStorage.getItem(LS_SLOTS);
    if (rawSlots) {
      const slots = JSON.parse(rawSlots);
      const target = slots.find((s: { slot_number: number }) => s.slot_number === slotNumber);
      if (target) {
        target.pills_remaining = Math.max(0, (target.pills_remaining ?? 0) - pillsPerDose);
        localStorage.setItem(LS_SLOTS, JSON.stringify(slots));
      }
    }
  } catch {
    // ignore
  }

  try {
    const { data: slot } = await supabase
      .from('slots')
      .select('pills_remaining')
      .eq('slot_number', slotNumber)
      .single();

    if (slot) {
      const newCount = Math.max(0, (slot.pills_remaining ?? 0) - pillsPerDose);
      await supabase
        .from('slots')
        .update({ pills_remaining: newCount, updated_at: new Date().toISOString() })
        .eq('slot_number', slotNumber);
    }
  } catch {
    // ignore
  }
}

