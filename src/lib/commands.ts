import { supabase } from './supabase';
import type { Command } from '../types';

/**
 * Insert a command into the commands table and return it.
 * The device will pick it up on its next poll (every 3 s).
 */
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
  return data as Command;
}

/**
 * Cancel a pending command (sets it to 'failed' with a "cancelled" result).
 */
export async function cancelCommand(id: number): Promise<void> {
  const { error } = await supabase
    .from('commands')
    .update({ status: 'failed', result: { note: 'Cancelled by user' }, done_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) throw error;
}

/**
 * Mark a dose event as taken via the website.
 */
export async function markTaken(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('dose_events')
    .update({ status: 'taken', taken_at: new Date().toISOString(), taken_via: 'website' })
    .eq('id', eventId);

  if (error) throw error;
  await sendCommand('stop_alarm', { event_id: eventId });
}

/**
 * Snooze a dose event for N minutes.
 */
export async function snoozeDose(eventId: string, minutes: number): Promise<void> {
  const snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();
  const { error } = await supabase
    .from('dose_events')
    .update({ status: 'snoozed', snooze_until: snoozeUntil })
    .eq('id', eventId);

  if (error) throw error;
  await sendCommand('snooze', { event_id: eventId, minutes });
}

/**
 * Skip a dose event.
 */
export async function skipDose(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('dose_events')
    .update({ status: 'skipped' })
    .eq('id', eventId);

  if (error) throw error;
  await sendCommand('skip', { event_id: eventId });
}

/**
 * Decrement pills_remaining for a slot by the given number of pills.
 * Called by the UI when it detects a dose becoming 'taken'.
 */
export async function decrementPills(slotNumber: number, pillsPerDose: number): Promise<void> {
  // Use rpc if available, else fetch-then-update
  const { data: slot, error: fetchErr } = await supabase
    .from('slots')
    .select('pills_remaining')
    .eq('slot_number', slotNumber)
    .single();

  if (fetchErr || !slot) return;

  const newCount = Math.max(0, (slot.pills_remaining ?? 0) - pillsPerDose);

  await supabase
    .from('slots')
    .update({ pills_remaining: newCount, updated_at: new Date().toISOString() })
    .eq('slot_number', slotNumber);
}
