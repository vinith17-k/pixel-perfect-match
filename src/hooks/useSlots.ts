import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Slot } from '../types';

const LS_SLOTS = 'sage_local_slots';

const DEFAULT_SLOTS: Slot[] = [
  {
    slot_number: 1,
    medicine_id: 'med-1',
    pills_remaining: 18,
    status: 'loaded',
    updated_at: new Date().toISOString(),
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
    slot_number: 2,
    medicine_id: 'med-2',
    pills_remaining: 24,
    status: 'loaded',
    updated_at: new Date().toISOString(),
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
    slot_number: 3,
    medicine_id: 'med-3',
    pills_remaining: 12,
    status: 'loaded',
    updated_at: new Date().toISOString(),
    medicine: {
      id: 'med-3',
      name: 'Amlodipine',
      dose: '5mg',
      notes: 'Blood pressure',
      color: '#6366f1',
      created_at: new Date().toISOString(),
    },
  },
  ...Array.from({ length: 5 }, (_, i) => ({
    slot_number: i + 4,
    medicine_id: null,
    pills_remaining: 0,
    status: 'empty' as const,
    updated_at: new Date().toISOString(),
    medicine: null,
  })),
];

function getLocalSlots(): Slot[] {
  try {
    const raw = localStorage.getItem(LS_SLOTS);
    if (!raw) return DEFAULT_SLOTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length >= 8 ? parsed : DEFAULT_SLOTS;
  } catch {
    return DEFAULT_SLOTS;
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

