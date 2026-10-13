import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { HardwareConfig } from '../types';

export function useHardwareConfig() {
  const [config, setConfig] = useState<HardwareConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('hardware_config')
        .select('*')
        .eq('id', 1)
        .single();

      if (fetchError) throw fetchError;
      setConfig(data as HardwareConfig);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch hardware config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchConfig();

    // Realtime subscription
    const channel = supabase
      .channel('hardware-config-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hardware_config' },
        () => { fetchConfig(); }
      )
      .subscribe();

    // Fallback polling every 5 seconds in case realtime drops
    pollRef.current = setInterval(fetchConfig, 5000);

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchConfig]);

  const update = useCallback(async (partial: Partial<Omit<HardwareConfig, 'id'>>) => {
    const { error: updateError } = await supabase
      .from('hardware_config')
      .update({ ...partial, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (updateError) throw updateError;
  }, []);

  return { config, loading, error, update };
}
