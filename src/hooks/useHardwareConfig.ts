import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { HardwareConfig } from '../types';

const LS_HW_CONFIG = 'sage_local_hardware_config';

const DEFAULT_CONFIG: HardwareConfig = {
  id: 1,
  has_oled: true,
  has_stepper: false,
  has_hall: false,
  has_ir: false,
  has_servo: false,
  has_button: false,
  has_led: false,
  has_buzzer: false,
  num_slots: 8,
  timezone: 'Asia/Kolkata',
  snooze_minutes: 10,
  missed_after_minutes: 30,
  low_stock_threshold: 3,
  updated_at: new Date().toISOString(),
};

function getLocalConfig(): HardwareConfig {
  try {
    const raw = localStorage.getItem(LS_HW_CONFIG);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function useHardwareConfig() {
  const [config, setConfig] = useState<HardwareConfig>(getLocalConfig);
  const [loading, setLoading] = useState(false);
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
      if (data) {
        const merged = { ...DEFAULT_CONFIG, ...(data as HardwareConfig) };
        setConfig(merged);
        localStorage.setItem(LS_HW_CONFIG, JSON.stringify(merged));
      }
      setError(null);
    } catch {
      // Graceful fallback to local cache
      const cached = getLocalConfig();
      setConfig(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();

    const channelId = `hw-config-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hardware_config' },
        () => { fetchConfig(); }
      )
      .subscribe();

    pollRef.current = setInterval(fetchConfig, 8000);

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchConfig]);

  const update = useCallback(async (partial: Partial<Omit<HardwareConfig, 'id'>>) => {
    // 1. Optimistically update local state & localStorage immediately
    setConfig((prev) => {
      const updated = { ...prev, ...partial, updated_at: new Date().toISOString() };
      localStorage.setItem(LS_HW_CONFIG, JSON.stringify(updated));
      return updated;
    });

    // 2. Try updating remote Supabase in background
    try {
      await supabase
        .from('hardware_config')
        .update({ ...partial, updated_at: new Date().toISOString() })
        .eq('id', 1);
    } catch {
      // Ignored if table not ready; local state is already saved
    }
  }, []);

  return { config, loading, error, update };
}

