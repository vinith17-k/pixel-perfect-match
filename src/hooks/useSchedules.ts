import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Schedule } from '../types';

export function useSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

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
      setSchedules((data ?? []) as Schedule[]);
    } catch {
      // Keep stale data on error
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

    // Fallback polling every 5 seconds
    const interval = setInterval(fetchSchedules, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchSchedules]);

  return { schedules, loading, refresh: fetchSchedules };
}
