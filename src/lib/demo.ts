import { supabase } from './supabase';
import type { Medicine, Slot, Schedule, DoseEvent } from '../types';
import { subDays } from 'date-fns';

// ============================================================
// Local Storage Keys
// ============================================================
const LS_MEDS = 'sage_local_medicines';
const LS_SLOTS = 'sage_local_slots';
const LS_SCHEDULES = 'sage_local_schedules';
const LS_DOSE_EVENTS = 'sage_local_dose_events';

// ============================================================
// Demo data definitions
// ============================================================
const DEMO_MEDICINES: Medicine[] = [
  {
    id: 'med-1',
    name: 'Metformin',
    dose: '500mg',
    notes: 'Take with food',
    color: '#14b8a6',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-2',
    name: 'Vitamin D3',
    dose: '1000IU',
    notes: 'Morning booster',
    color: '#f59e0b',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-3',
    name: 'Amlodipine',
    dose: '5mg',
    notes: 'Blood pressure',
    color: '#6366f1',
    created_at: new Date().toISOString(),
  },
];

const SCHEDULE_TIMES = ['08:00:00', '13:00:00', '21:00:00'];

/**
 * Load demo data: 3 medicines, slots 1-3 loaded, 3 schedules, 10 days history.
 * Resilient to offline/local-first operations and syncs with Supabase when available.
 */
export async function loadDemoData(): Promise<void> {
  const now = new Date();

  // 1. Prepare slots 1-8
  const demoSlots: Slot[] = [
    {
      slot_number: 1,
      medicine_id: DEMO_MEDICINES[0].id,
      pills_remaining: 20,
      status: 'loaded',
      updated_at: now.toISOString(),
      medicine: DEMO_MEDICINES[0],
    },
    {
      slot_number: 2,
      medicine_id: DEMO_MEDICINES[1].id,
      pills_remaining: 25,
      status: 'loaded',
      updated_at: now.toISOString(),
      medicine: DEMO_MEDICINES[1],
    },
    {
      slot_number: 3,
      medicine_id: DEMO_MEDICINES[2].id,
      pills_remaining: 14,
      status: 'loaded',
      updated_at: now.toISOString(),
      medicine: DEMO_MEDICINES[2],
    },
    ...Array.from({ length: 5 }, (_, i) => ({
      slot_number: i + 4,
      medicine_id: null,
      pills_remaining: 0,
      status: 'empty' as const,
      updated_at: now.toISOString(),
      medicine: null,
    })),
  ];

  // 2. Prepare schedules
  const demoSchedules: Schedule[] = DEMO_MEDICINES.map((med, i) => ({
    id: `sched-${i + 1}`,
    slot_number: i + 1,
    medicine_id: med.id,
    time_of_day: SCHEDULE_TIMES[i],
    days: [0, 1, 2, 3, 4, 5, 6],
    pills_per_dose: 1,
    enabled: true,
    created_at: now.toISOString(),
    medicine: med,
  }));

  // 3. Generate 10 days of history with realistic adherence (~88%)
  const historyEvents: DoseEvent[] = [];

  for (let day = 10; day >= 1; day--) {
    const date = subDays(now, day);

    for (let s = 0; s < demoSchedules.length; s++) {
      const schedule = demoSchedules[s];
      const medicine = DEMO_MEDICINES[s];
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
        id: `event-${day}-${s + 1}`,
        schedule_id: schedule.id,
        slot_number: schedule.slot_number,
        medicine_name: medicine.name,
        dose: medicine.dose,
        scheduled_for: scheduledFor.toISOString(),
        status,
        taken_at: takenAt,
        taken_via: takenVia,
        snooze_until: null,
        created_at: scheduledFor.toISOString(),
      });
    }
  }

  // Add today's events
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  historyEvents.push(
    {
      id: `event-today-1`,
      schedule_id: 'sched-1',
      slot_number: 1,
      medicine_name: 'Metformin',
      dose: '500mg',
      scheduled_for: new Date(y, m, d, 8, 0, 0).toISOString(),
      status: 'taken',
      taken_at: new Date(y, m, d, 8, 4, 0).toISOString(),
      taken_via: 'website',
      snooze_until: null,
      created_at: new Date().toISOString(),
    },
    {
      id: `event-today-2`,
      schedule_id: 'sched-2',
      slot_number: 2,
      medicine_name: 'Vitamin D3',
      dose: '1000IU',
      scheduled_for: new Date(y, m, d, 13, 0, 0).toISOString(),
      status: 'due',
      taken_at: null,
      taken_via: null,
      snooze_until: null,
      created_at: new Date().toISOString(),
    },
    {
      id: `event-today-3`,
      schedule_id: 'sched-3',
      slot_number: 3,
      medicine_name: 'Amlodipine',
      dose: '5mg',
      scheduled_for: new Date(y, m, d, 21, 0, 0).toISOString(),
      status: 'due',
      taken_at: null,
      taken_via: null,
      snooze_until: null,
      created_at: new Date().toISOString(),
    }
  );

  // 4. Save to localStorage immediately (Local-First Guarantee)
  try {
    localStorage.setItem(LS_MEDS, JSON.stringify(DEMO_MEDICINES));
    localStorage.setItem(LS_SLOTS, JSON.stringify(demoSlots));
    localStorage.setItem(LS_SCHEDULES, JSON.stringify(demoSchedules));
    localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(historyEvents));
  } catch (err) {
    console.warn('[Demo] Could not persist to localStorage:', err);
  }

  // 5. Sync to Supabase in background if available
  try {
    const { data: existing } = await supabase.from('medicines').select('id').limit(1);
    if (!existing || existing.length === 0) {
      const { data: meds } = await supabase
        .from('medicines')
        .insert(DEMO_MEDICINES.map(({ id: _, created_at: __, ...rest }) => rest))
        .select();

      if (meds && meds.length > 0) {
        for (let i = 0; i < Math.min(3, meds.length); i++) {
          await supabase
            .from('slots')
            .update({
              medicine_id: meds[i].id,
              pills_remaining: 20,
              status: 'loaded',
              updated_at: new Date().toISOString(),
            })
            .eq('slot_number', i + 1);
        }

        const schedulesToInsert = meds.map((med, i) => ({
          slot_number: i + 1,
          medicine_id: med.id,
          time_of_day: SCHEDULE_TIMES[i],
          days: [0, 1, 2, 3, 4, 5, 6],
          pills_per_dose: 1,
          enabled: true,
        }));

        await supabase.from('schedules').insert(schedulesToInsert);
      }
    }
  } catch (dbErr) {
    console.info('[Demo] Supabase sync completed with local fallback active:', dbErr);
  }
}

/**
 * Remove all demo data (medicines, slots reset, schedules, events) both locally and in remote DB.
 */
export async function clearDemoData(): Promise<void> {
  const emptySlots: Slot[] = Array.from({ length: 8 }, (_, i) => ({
    slot_number: i + 1,
    medicine_id: null,
    pills_remaining: 0,
    status: 'empty' as const,
    updated_at: new Date().toISOString(),
    medicine: null,
  }));

  try {
    localStorage.setItem(LS_MEDS, JSON.stringify([]));
    localStorage.setItem(LS_SLOTS, JSON.stringify(emptySlots));
    localStorage.setItem(LS_SCHEDULES, JSON.stringify([]));
    localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify([]));
  } catch (err) {
    console.warn('[Demo] Could not clear localStorage:', err);
  }

  // Attempt database cleanup in background
  try {
    await supabase.from('dose_events').delete().not('id', 'is', null);
    await supabase.from('schedules').delete().not('id', 'is', null);
    await supabase
      .from('slots')
      .update({ medicine_id: null, pills_remaining: 0, status: 'empty', updated_at: new Date().toISOString() })
      .gte('slot_number', 1);
    await supabase.from('medicines').delete().not('id', 'is', null);
  } catch (err) {
    console.warn('[Demo] Supabase remote cleanup caught, local state cleared:', err);
  }
}

/**
 * Check if the database or local storage is empty.
 */
export async function isDbEmpty(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(LS_MEDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return false;
    }
  } catch {
    // fallback
  }

  try {
    const { data } = await supabase.from('medicines').select('id').limit(1);
    return !data || data.length === 0;
  } catch {
    return false;
  }
}
