import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { DeviceStatus } from '../types';

const ONLINE_THRESHOLD_MS = 30_000; // 30 seconds
const LS_DEV_STATUS = 'sage_local_device_status';

const DEFAULT_DEV_STATUS: DeviceStatus = {
  id: 1,
  last_seen: new Date().toISOString(),
  state: 'idle',
  current_slot: 1,
  active_event_id: null,
  ip: '10.51.16.35',
  rssi: -58,
  firmware: 'v2.0.0-esp32',
  uptime_s: 120,
  oled_screen: {
    screen: 'home',
    lines: ['10:42', 'Thu 15 Oct', 'Next: Metformin 13:00 S1'],
  },
  parts_ok: {
    oled: true,
    stepper: true,
    button: true,
    led: true,
    buzzer: true,
  },
};

function getLocalStatus(): DeviceStatus {
  try {
    const raw = localStorage.getItem(LS_DEV_STATUS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_DEV_STATUS;
}

export function saveLocalDeviceStatus(partial: Partial<DeviceStatus>) {
  try {
    const current = getLocalStatus();
    const updated = { ...current, ...partial, last_seen: new Date().toISOString() };
    localStorage.setItem(LS_DEV_STATUS, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_DEV_STATUS;
  }
}

export function useDeviceStatus() {
  const [status, setStatus] = useState<DeviceStatus>(getLocalStatus);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('device_status')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      if (data) {
        setStatus(data as DeviceStatus);
        localStorage.setItem(LS_DEV_STATUS, JSON.stringify(data));
      }
    } catch {
      // Fallback to local state with current timestamp
      const local = getLocalStatus();
      setStatus(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const channelId = `dev-status-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
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

  // Keep heartbeat alive if local device status is updated
  const isOnline = Boolean(
    status?.last_seen &&
    Date.now() - new Date(status.last_seen).getTime() < ONLINE_THRESHOLD_MS
  );

  return { status, loading, isOnline };
}
