import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Slot } from '../types';

export function useSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

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
      setSlots((data ?? []) as Slot[]);
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();

    // Subscribe to both slots and medicines so joins stay fresh
    const slotsChannel = supabase
      .channel('slots-changes')
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

    // Fallback polling every 5 seconds
    const interval = setInterval(fetchSlots, 5000);

    return () => {
      supabase.removeChannel(slotsChannel);
      clearInterval(interval);
    };
  }, [fetchSlots]);

  return { slots, loading, refresh: fetchSlots };
}
