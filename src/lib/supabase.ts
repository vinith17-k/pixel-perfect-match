import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

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
