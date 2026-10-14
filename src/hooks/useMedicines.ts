import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Medicine } from '../types';

const LS_MEDS = 'sage_local_medicines';

const DEFAULT_MEDICINES: Medicine[] = [
  {
    id: 'med-1',
    name: 'Metformin',
    dose: '500mg',
    notes: 'Take with meal',
    color: '#14b8a6',
    created_at: new Date().toISOString(),
  },
  {
    id: 'med-2',
    name: 'Vitamin D3',
    dose: '1000IU',
    notes: 'Morning boost',
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

function getLocalMedicines(): Medicine[] {
  try {
    const raw = localStorage.getItem(LS_MEDS);
    if (!raw) return DEFAULT_MEDICINES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MEDICINES;
  } catch {
    return DEFAULT_MEDICINES;
  }
}

export function useMedicines() {
  const [medicines, setMedicines] = useState<Medicine[]>(getLocalMedicines);
  const [loading, setLoading] = useState(false);

  const fetchMedicines = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setMedicines(data as Medicine[]);
        localStorage.setItem(LS_MEDS, JSON.stringify(data));
      } else {
        setMedicines(getLocalMedicines());
      }
    } catch {
      setMedicines(getLocalMedicines());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines();

    const channelId = `meds-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicines' },
        () => { fetchMedicines(); }
      )
      .subscribe();

    const interval = setInterval(fetchMedicines, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchMedicines]);


  return { medicines, loading, refresh: fetchMedicines };
}
