import { supabase } from './supabase';
import type { Medicine, Slot, Schedule, DoseEvent } from '../types';
import { subDays, parseISO, startOfDay, endOfDay } from 'date-fns';

// ============================================================
// Demo data definitions
// ============================================================

const DEMO_MEDICINES: Omit<Medicine, 'id' | 'created_at'>[] = [
  { name: 'Metformin', dose: '500mg', notes: 'Take with food', color: '#14b8a6' },
  { name: 'Vitamin D3', dose: '1000IU', notes: null, color: '#f59e0b' },
  { name: 'Amlodipine', dose: '5mg', notes: 'Blood pressure', color: '#6366f1' },
];

const SCHEDULE_TIMES = ['08:00:00', '13:00:00', '21:00:00'];

/**
 * Load demo data: 3 medicines, slots 1-3 loaded, 3 schedules, 10 days history.
 * Safe to call multiple times (checks if data already exists).
 */
export async function loadDemoData(): Promise<void> {
  // Check if demo data already exists
  const { data: existing } = await supabase
    .from('medicines')
    .select('id')
    .limit(1);

  if (existing && existing.length > 0) {
    console.info('[Demo] Data already exists, skipping seed.');
    return;
  }

  // Insert medicines
  const { data: medicines, error: medErr } = await supabase
    .from('medicines')
    .insert(DEMO_MEDICINES)
    .select();

  if (medErr || !medicines) throw medErr ?? new Error('Failed to insert medicines');

  // Update slots 1-3
  for (let i = 0; i < 3; i++) {
    await supabase
      .from('slots')
      .update({
        medicine_id: medicines[i].id,
        pills_remaining: 20,
        status: 'loaded',
        updated_at: new Date().toISOString(),
      })
      .eq('slot_number', i + 1);
  }

  // Insert schedules
  const schedulesToInsert = medicines.map((med, i) => ({
    slot_number: i + 1,
    medicine_id: med.id,
    time_of_day: SCHEDULE_TIMES[i],
    days: [0, 1, 2, 3, 4, 5, 6],
    pills_per_dose: 1,
    enabled: true,
  }));

  const { data: schedules, error: schedErr } = await supabase
    .from('schedules')
    .insert(schedulesToInsert)
    .select();

  if (schedErr || !schedules) throw schedErr ?? new Error('Failed to insert schedules');

  // Generate 10 days of history with ~90% adherence
  const historyEvents: Omit<DoseEvent, 'id' | 'created_at'>[] = [];
  const now = new Date();

  for (let day = 10; day >= 1; day--) {
    const date = subDays(now, day);

    for (let s = 0; s < schedules.length; s++) {
      const schedule = schedules[s];
      const medicine = medicines[s];
      const [h, m] = SCHEDULE_TIMES[s].split(':').map(Number);

      const scheduledFor = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        h, m, 0, 0
      );

      const rand = Math.random();
      let status: DoseEvent['status'];
      let takenAt: string | null = null;
      let takenVia: DoseEvent['taken_via'] = null;

      if (rand < 0.85) {
        status = 'taken';
        takenAt = new Date(scheduledFor.getTime() + Math.random() * 900000).toISOString();
        takenVia = Math.random() > 0.5 ? 'button' : 'website';
      } else if (rand < 0.92) {
        status = 'missed';
      } else if (rand < 0.96) {
        status = 'skipped';
      } else {
        status = 'snoozed';
      }

      historyEvents.push({
        schedule_id: schedule.id,
        slot_number: schedule.slot_number,
        medicine_name: medicine.name,
        dose: medicine.dose,
        scheduled_for: scheduledFor.toISOString(),
        status,
        taken_at: takenAt,
        taken_via: takenVia,
        snooze_until: null,
      });
    }
  }

  const { error: eventsErr } = await supabase
    .from('dose_events')
    .insert(historyEvents);

  if (eventsErr) throw eventsErr;

  console.info('[Demo] Demo data loaded successfully.');
}

/**
 * Remove all demo data (medicines, slots reset, schedules, events).
 */
export async function clearDemoData(): Promise<void> {
  // Clear events first (FK constraints)
  await supabase.from('dose_events').delete().not('id', 'is', null);
  await supabase.from('schedules').delete().not('id', 'is', null);

  // Reset slots
  await supabase
    .from('slots')
    .update({ medicine_id: null, pills_remaining: 0, status: 'empty', updated_at: new Date().toISOString() })
    .gte('slot_number', 1);

  await supabase.from('medicines').delete().not('id', 'is', null);
}

/**
 * Check if the tables are empty (for first-launch seed).
 */
export async function isDbEmpty(): Promise<boolean> {
  const { data } = await supabase.from('medicines').select('id').limit(1);
  return !data || data.length === 0;
}
