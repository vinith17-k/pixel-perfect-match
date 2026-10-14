import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Command, CommandStatus } from '../types';

const PAGE_SIZE = 20;

const LS_COMMANDS = 'sage_local_commands';

function getLocalCommands(): Command[] {
  try {
    const raw = localStorage.getItem(LS_COMMANDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useCommands() {
  const [commands, setCommands] = useState<Command[]>(getLocalCommands);
  const [loading, setLoading] = useState(false);

  const fetchCommands = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('commands')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      if (data && data.length > 0) {
        setCommands(data as Command[]);
        localStorage.setItem(LS_COMMANDS, JSON.stringify(data));
      } else {
        setCommands(getLocalCommands());
      }
    } catch {
      setCommands(getLocalCommands());
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchCommands();

    const channelId = `commands-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
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
