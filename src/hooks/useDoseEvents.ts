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

const LS_DOSE_EVENTS = 'sage_local_dose_events';

function generateDefaultEvents(): DoseEvent[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  return [
    {
      id: 'event-today-1',
      schedule_id: 'sched-1',
      slot_number: 1,
      medicine_name: 'Metformin',
      dose: '500mg',
      scheduled_for: new Date(y, m, d, 8, 0, 0).toISOString(),
      status: 'taken',
      taken_at: new Date(y, m, d, 8, 5, 0).toISOString(),
      taken_via: 'website',
      snooze_until: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'event-today-2',
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
      id: 'event-today-3',
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
    },
  ];
}

function getLocalEvents(): DoseEvent[] {
  try {
    const raw = localStorage.getItem(LS_DOSE_EVENTS);
    if (!raw) {
      const def = generateDefaultEvents();
      localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(def));
      return def;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : generateDefaultEvents();
  } catch {
    return generateDefaultEvents();
  }
}

export function useDoseEvents(dateRange: DateRange = {}) {
  const [events, setEvents] = useState<DoseEvent[]>(getLocalEvents);
  const [loading, setLoading] = useState(false);

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
      if (data && data.length > 0) {
        setEvents(data as DoseEvent[]);
        localStorage.setItem(LS_DOSE_EVENTS, JSON.stringify(data));
      } else {
        setEvents(getLocalEvents());
      }
    } catch {
      setEvents(getLocalEvents());
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
