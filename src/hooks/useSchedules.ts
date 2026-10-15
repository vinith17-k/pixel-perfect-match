import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Schedule } from '../types';

const LS_SCHEDULES = 'sage_local_schedules';

function getLocalSchedules(): Schedule[] {
  try {
    const raw = localStorage.getItem(LS_SCHEDULES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
      if (data) {
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
