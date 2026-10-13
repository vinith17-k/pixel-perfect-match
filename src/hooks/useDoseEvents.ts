import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DoseEvent } from '../types';

interface DateRange {
  from?: string; // ISO UTC string
  to?: string;   // ISO UTC string
}

/** Returns UTC midnight boundaries for today (local calendar day is irrelevant here;
 *  we use UTC day to match the database's scheduled_for timestamps). */
function getTodayUtcRange(): { from: string; to: string } {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  return {
    from: startOfDay.toISOString(),
    to: endOfDay.toISOString(),
  };
}

export function useDoseEvents(dateRange: DateRange = {}) {
  const [events, setEvents] = useState<DoseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve the effective range: caller-supplied or today UTC
  const todayRange = getTodayUtcRange();
  const effectiveFrom = dateRange.from ?? todayRange.from;
  const effectiveTo = dateRange.to ?? todayRange.to;

  const fetchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dose_events')
        .select('*')
        .gte('scheduled_for', effectiveFrom)
        .lte('scheduled_for', effectiveTo)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setEvents((data ?? []) as DoseEvent[]);
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [effectiveFrom, effectiveTo]);

  useEffect(() => {
    fetchEvents();

    const channelId = `dose-events-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dose_events' },
        () => { fetchEvents(); }
      )
      .subscribe();

    // Fallback polling every 5 seconds
    const interval = setInterval(fetchEvents, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchEvents]);

  // Today's events – re-computed from the fetched list
  const todayBounds = getTodayUtcRange();
  const todayEvents = events.filter((e) => {
    const t = new Date(e.scheduled_for).getTime();
    return t >= new Date(todayBounds.from).getTime() && t <= new Date(todayBounds.to).getTime();
  });

  const dueEvents = events.filter((e) => e.status === 'due');

  return { events, loading, todayEvents, dueEvents };
}
