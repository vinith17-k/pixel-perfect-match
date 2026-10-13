import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Medicine } from '../types';

export function useMedicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMedicines = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setMedicines((data ?? []) as Medicine[]);
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines();

    const channel = supabase
      .channel('medicines-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medicines' },
        () => { fetchMedicines(); }
      )
      .subscribe();

    // Fallback polling every 5 seconds
    const interval = setInterval(fetchMedicines, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchMedicines]);

  return { medicines, loading, refresh: fetchMedicines };
}
