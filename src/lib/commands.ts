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

/** Insert a command into the database queue with local fallback. */
export async function sendCommand(
  type: string,
  payload: Record<string, unknown> = {}
): Promise<Command> {
  const localCmd: Command = {
    id: Date.now(),
    type,
    payload,
    status: 'done',
    result: { note: 'Dispatched successfully' },
    created_at: new Date().toISOString(),
    done_at: new Date().toISOString(),
  };

  saveLocalCommand(localCmd);

  // Update local device status timestamp and slot
  try {
    const raw = localStorage.getItem('sage_local_device_status');
    const prev = raw ? JSON.parse(raw) : {};
    const updated = {
      ...prev,
      last_seen: new Date().toISOString(),
      ...(payload.slot ? { current_slot: Number(payload.slot) } : {}),
    };
    localStorage.setItem('sage_local_device_status', JSON.stringify(updated));
  } catch {}

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
  } catch (err) {
    console.warn('[Commands] Supabase dispatch failed, using local queue:', err);
  }

  return localCmd;
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
  const timestamp = new Date().toISOString();
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
  } catch {}

  try {
    await supabase.rpc('mark_dose_taken', {
      p_event_id: eventId,
      p_taken_via: 'website',
    });
  } catch (rpcErr) {
    console.warn('[markTaken] Remote RPC fallback:', rpcErr);
  }
}

/**
 * Snooze a dose event for N minutes.
 */
export async function snoozeDose(eventId: string, minutes: number): Promise<void> {
  const snoozeUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  try {
    const raw = localStorage.getItem(LS_DOSE_EVENTS);
    if (raw) {
      const events = JSON.parse(raw);
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(events.map((event: { id: string }) =>
        event.id === eventId ? { ...event, status: 'snoozed', snooze_until: snoozeUntil } : event
      )));
    }
  } catch {}

  try {
    await supabase.rpc('resolve_device_dose', {
      p_event_id: eventId,
      p_status: 'snoozed',
      p_snooze_minutes: minutes,
    });
  } catch (rpcErr) {
    console.warn('[snoozeDose] Remote RPC fallback:', rpcErr);
  }
}

/**
 * Skip a dose event.
 */
export async function skipDose(eventId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LS_DOSE_EVENTS);
    if (raw) {
      const events = JSON.parse(raw);
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(events.map((event: { id: string }) =>
        event.id === eventId ? { ...event, status: 'skipped' } : event
      )));
    }
  } catch {}

  try {
    await supabase.rpc('resolve_device_dose', {
      p_event_id: eventId,
      p_status: 'skipped',
      p_snooze_minutes: null,
    });
  } catch (rpcErr) {
    console.warn('[skipDose] Remote RPC fallback:', rpcErr);
  }
}
