import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { DeviceStatus } from '../types';

const ONLINE_THRESHOLD_MS = 30_000; // 30 seconds

export function useDeviceStatus() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('device_status')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      setStatus(data as DeviceStatus);
    } catch {
      // Silently fail – caller can infer offline from null status
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const channel = supabase
      .channel('device-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_status' },
        () => { fetchStatus(); }
      )
      .subscribe();

    // Fallback polling every 5 seconds
    pollRef.current = setInterval(fetchStatus, 5000);

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  const isOnline = Boolean(
    status?.last_seen &&
    Date.now() - new Date(status.last_seen).getTime() < ONLINE_THRESHOLD_MS
  );

  return { status, loading, isOnline };
}
