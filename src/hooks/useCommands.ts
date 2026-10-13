import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Command, CommandStatus } from '../types';

const PAGE_SIZE = 20;

export function useCommands() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommands = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('commands')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      setCommands((data ?? []) as Command[]);
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommands();

    const channel = supabase
      .channel('commands-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commands' },
        () => { fetchCommands(); }
      )
      .subscribe();

    // Fallback polling every 5 seconds
    const interval = setInterval(fetchCommands, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchCommands]);

  const pendingCount = commands.filter(
    (c) => (c.status as CommandStatus) === 'pending' || (c.status as CommandStatus) === 'running'
  ).length;

  return { commands, loading, pendingCount };
}
