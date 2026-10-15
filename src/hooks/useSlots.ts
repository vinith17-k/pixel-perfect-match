import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Slot } from '../types';

const LS_SLOTS = 'sage_local_slots';

const EMPTY_SLOTS: Slot[] = Array.from({ length: 8 }, (_, i) => ({
  slot_number: i + 1,
  medicine_id: null,
  pills_remaining: 0,
  status: 'empty',
  updated_at: new Date(0).toISOString(),
  medicine: null,
}));

function getLocalSlots(): Slot[] {
  try {
    const raw = localStorage.getItem(LS_SLOTS);
    if (!raw) return EMPTY_SLOTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length >= 8 ? parsed : EMPTY_SLOTS;
  } catch {
    return EMPTY_SLOTS;
  }
}

export function useSlots() {
  const [slots, setSlots] = useState<Slot[]>(getLocalSlots);
  const [loading, setLoading] = useState(false);

  const fetchSlots = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('slots')
        .select(`
          *,
          medicine:medicines(*)
        `)
        .order('slot_number', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setSlots(data as Slot[]);
        localStorage.setItem(LS_SLOTS, JSON.stringify(data));
      } else {
        // Fall back to local slots
        setSlots(getLocalSlots());
      }
    } catch {
      setSlots(getLocalSlots());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();

    const channelId = `slots-${Math.random().toString(36).slice(2, 9)}`;
    const slotsChannel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slots' },
        () => { fetchSlots(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicines' },
        () => { fetchSlots(); }
      )
      .subscribe();

    const interval = setInterval(fetchSlots, 8000);

    return () => {
      supabase.removeChannel(slotsChannel);
      clearInterval(interval);
    };
  }, [fetchSlots]);

  return { slots, loading, refresh: fetchSlots };
}
