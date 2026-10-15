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

/** Insert a command into the authenticated database queue. */
export async function sendCommand(
  type: string,
  payload: Record<string, unknown> = {}
): Promise<Command> {
  const { data, error } = await supabase
    .from('commands')
    .insert({ type, payload })
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('Command insert returned no row.');
  saveLocalCommand(data as Command);
  return data as Command;
}

/**
 * Cancel a pending command.
 */
export async function cancelCommand(id: number): Promise<void> {
  const { data, error } = await supabase
    .from('commands')
    .update({ status: 'failed', result: { note: 'Cancelled by user' }, done_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Command is no longer pending and cannot be cancelled.');

  try {
    const cmds = getLocalCommands().map((c) =>
      c.id === id ? { ...c, status: 'failed' as const, result: { note: 'Cancelled by user' } } : c
    );
    localStorage.setItem(LS_COMMANDS, JSON.stringify(cmds));
  } catch (cacheError) {
    console.error('Command was cancelled remotely, but the local cache could not be updated:', cacheError);
  }
}

/**
 * Mark a dose event as taken via the website.
 */
export async function markTaken(eventId: string): Promise<void> {
  const { data, error } = await supabase.rpc('mark_dose_taken', {
    p_event_id: eventId,
    p_taken_via: 'website',
  });
  if (error) throw error;

  const timestamp = new Date().toISOString();
  const result = data && typeof data === 'object' && !Array.isArray(data)
    ? data as { already_taken?: boolean; slot_number?: number; pills_remaining?: number }
    : {};
  try {
    const rawEvents = localStorage.getItem(LS_DOSE_EVENTS);
    if (rawEvents) {
      const events = JSON.parse(rawEvents);
      const updated = events.map((event: { id: string }) =>
        event.id === eventId
          ? { ...event, status: 'taken', taken_at: timestamp, taken_via: 'website', snooze_until: null }
          : event
      );
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(updated));
    }

    if (!result.already_taken && typeof result.slot_number === 'number' &&
        typeof result.pills_remaining === 'number') {
      const rawSlots = localStorage.getItem(LS_SLOTS);
      if (rawSlots) {
        const slots = JSON.parse(rawSlots);
        const updated = slots.map((slot: { slot_number: number }) =>
          slot.slot_number === result.slot_number
            ? { ...slot, pills_remaining: result.pills_remaining, updated_at: timestamp }
            : slot
        );
        localStorage.setItem(LS_SLOTS, JSON.stringify(updated));
      }
    }
  } catch (cacheError) {
    console.error('Dose was saved remotely, but the local cache could not be updated:', cacheError);
  }
}

/**
 * Snooze a dose event for N minutes.
 */
export async function snoozeDose(eventId: string, minutes: number): Promise<void> {
  const { data, error } = await supabase.rpc('resolve_device_dose', {
    p_event_id: eventId,
    p_status: 'snoozed',
    p_snooze_minutes: minutes,
  });
  if (error) throw error;
  if (!data) throw new Error('Dose is no longer actionable.');
  const snoozeUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  try {
    const raw = localStorage.getItem(LS_DOSE_EVENTS);
    if (raw) {
      const events = JSON.parse(raw);
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(events.map((event: { id: string }) =>
        event.id === eventId ? { ...event, status: 'snoozed', snooze_until: snoozeUntil } : event
      )));
    }
  } catch (cacheError) {
    console.error('Dose was snoozed remotely, but the local cache could not be updated:', cacheError);
  }
}

/**
 * Skip a dose event.
 */
export async function skipDose(eventId: string): Promise<void> {
  const { data, error } = await supabase.rpc('resolve_device_dose', {
    p_event_id: eventId,
    p_status: 'skipped',
    p_snooze_minutes: null,
  });
  if (error) throw error;
  if (!data) throw new Error('Dose is no longer actionable.');
  try {
    const raw = localStorage.getItem(LS_DOSE_EVENTS);
    if (raw) {
      const events = JSON.parse(raw);
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(events.map((event: { id: string }) =>
        event.id === eventId ? { ...event, status: 'skipped', snooze_until: null } : event
      )));
    }
  } catch (cacheError) {
    console.error('Dose was skipped remotely, but the local cache could not be updated:', cacheError);
  }
}
