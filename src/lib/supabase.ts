import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL;

const configuredKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabaseUrl = configuredUrl || 'https://missing-project.supabase.co';
const supabaseKey = configuredKey || 'missing-supabase-key';
export const hasSupabaseConfig = Boolean(configuredUrl && configuredKey);

// Support both traditional JWT anon keys and new Supabase publishable keys (sb_publishable_...)
const customFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (supabaseKey.startsWith('sb_publishable_') && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
    headers.delete('Authorization');
  }
  headers.set('apikey', supabaseKey);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: customFetch,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
