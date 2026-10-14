import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Schedule } from '../types';

const LS_SCHEDULES = 'sage_local_schedules';

const DEFAULT_SCHEDULES: Schedule[] = [
  {
    id: 'sched-1',
    slot_number: 1,
    medicine_id: 'med-1',
    time_of_day: '08:00:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    pills_per_dose: 1,
    enabled: true,
    created_at: new Date().toISOString(),
    medicine: {
      id: 'med-1',
      name: 'Metformin',
      dose: '500mg',
      notes: 'Take with meal',
      color: '#14b8a6',
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'sched-2',
    slot_number: 2,
    medicine_id: 'med-2',
    time_of_day: '13:00:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    pills_per_dose: 1,
    enabled: true,
    created_at: new Date().toISOString(),
    medicine: {
      id: 'med-2',
      name: 'Vitamin D3',
      dose: '1000IU',
      notes: 'Morning boost',
      color: '#f59e0b',
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'sched-3',
    slot_number: 3,
    medicine_id: 'med-3',
    time_of_day: '21:00:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    pills_per_dose: 1,
    enabled: true,
    created_at: new Date().toISOString(),
    medicine: {
      id: 'med-3',
      name: 'Amlodipine',
      dose: '5mg',
      notes: 'Blood pressure',
      color: '#6366f1',
      created_at: new Date().toISOString(),
    },
  },
];

function getLocalSchedules(): Schedule[] {
  try {
    const raw = localStorage.getItem(LS_SCHEDULES);
    if (!raw) return DEFAULT_SCHEDULES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SCHEDULES;
  } catch {
    return DEFAULT_SCHEDULES;
  }
}

export function useSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>(getLocalSchedules);
  const [loading, setLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          medicine:medicines(*),
          slot:slots(*)
        `)
        .order('time_of_day', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setSchedules(data as Schedule[]);
        localStorage.setItem(LS_SCHEDULES, JSON.stringify(data));
      } else {
        setSchedules(getLocalSchedules());
      }
    } catch {
      setSchedules(getLocalSchedules());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();

    const channelId = `schedules-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => { fetchSchedules(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicines' },
        () => { fetchSchedules(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slots' },
        () => { fetchSchedules(); }
      )
      .subscribe();

    const interval = setInterval(fetchSchedules, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchSchedules]);


  return { schedules, loading, refresh: fetchSchedules };
}
